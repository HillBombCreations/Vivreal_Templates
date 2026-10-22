import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child). Registered before the dynamic `import("./route.tsx")` below so it
// intercepts it; see `testSupport/routeLoader.mjs` for what it fakes and why.
register(new URL("./testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * vivreal-hq review-templates204-2026-10-21.md, Fold in: a failing
 * `/tenant/definedCollectionObject` write used to be logged and swallowed, so
 * every sign-up was lost with nothing in Sentry. These drive the real
 * `POST()` and the real `subscribeUser` + `doClientFetch` against a mocked
 * upstream `fetch`, and read what reached the Sentry stub.
 */

/** Never allowed in any capture. The controls below prove it really travels. */
const EMAIL_SENTINEL = "sentinel-7f3a9c@subscriber.example";
const COLLECTION_ID = "65f0c0ffee0000000000abcd";
const SITE_ID = "subscribe-test-site";

/** The route only calls `.json()` and `.headers.get(...)` on its request. */
function fakeRequest(body: unknown): Request {
  // Duck-typed on purpose: these two members are all `POST` reads, and the
  // real `Request` would need a body stream for no gain here.
  return { json: async () => body, headers: { get: () => null } } as unknown as Request;
}

/** Shape `../contact/testSupport/sentryStub.mjs` exposes; the real SDK's
 * types have no `__sentryStubControl`, the loader swaps the module. */
interface SentryStubModule {
  __sentryStubControl: {
    readonly flushCalls: ReadonlyArray<{ timeout: number; at: number }>;
    readonly captureCalls: ReadonlyArray<{
      message: string;
      context: unknown;
      at: number;
      /** Processors added by an enclosing `withScope`, in order. */
      eventProcessors: ReadonlyArray<(event: SyntheticEvent) => SyntheticEvent>;
    }>;
    resolveFlush(value?: boolean): void;
    reset(): void;
  };
}

/** The parts of a Sentry event the SDK would fill in from this request. */
interface SyntheticEvent {
  message?: string;
  tags?: Record<string, string>;
  breadcrumbs?: Array<{ category: string; message: string }>;
  request?: { method?: string; url?: string; data?: string; headers?: Record<string, string> };
}

/** One `setImmediate` tick drains every queued microtask (see the contact route test). */
async function drain() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const realFetch = globalThis.fetch;
const realSiteId = process.env.SITE_ID;

test("/api/subscribe reports a lost sign-up to Sentry, never the address", async (t) => {
  process.env.SITE_ID = SITE_ID;
  const { POST } = await import("./route.tsx");
  // See `SentryStubModule` for why this cast is the true runtime shape.
  const { __sentryStubControl: sentry } = (await import("@sentry/nextjs")) as unknown as SentryStubModule;

  /** Upstream request bodies this test's mocked `fetch` received. */
  let upstreamBodies: string[] = [];
  function mockUpstream(answer: () => Promise<Response>) {
    upstreamBodies = [];
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      if (!url.endsWith("/tenant/definedCollectionObject")) throw new Error(`unexpected fetch: ${url}`);
      upstreamBodies.push(String(init?.body));
      return answer();
    };
  }
  const rejectQuotingTheEmail = (status: number) => async () =>
    new Response(JSON.stringify({ success: false, error: `Refused ${EMAIL_SENTINEL}` }), {
      status,
      headers: { "content-type": "application/json" },
    });

  /** Run `POST`, proving it does not answer until the stub's flush settles. */
  async function postAndWaitForFlush(body: unknown) {
    const pending = POST(fakeRequest(body));
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await drain();
    assert.equal(sentry.captureCalls.length, 1, "exactly one capture for this refusal");
    assert.equal(sentry.flushCalls.length, 1, "the capture must be flushed");
    assert.equal(settled, false, "the response must wait for the flush");
    sentry.resolveFlush(true);
    return pending;
  }

  /**
   * The capture context is not all an event carries: on Node the SDK adds the
   * incoming body as `request.data` and every console line of the request as
   * a breadcrumb. Run the capture's own scope processors over an event that
   * holds the sentinel in both places, the way the SDK runs them last.
   */
  function assertEventIsScrubbed(call: (typeof sentry.captureCalls)[number]) {
    assert.equal(call.eventProcessors.length, 1, "the capture must be made inside the scrubbing scope");
    const raw: SyntheticEvent = {
      message: call.message,
      tags: { stage: "upstream-rejected" },
      breadcrumbs: [{ category: "console", message: `[subscribeUser] error: ApiError: Refused ${EMAIL_SENTINEL}` }],
      request: {
        method: "POST",
        url: "https://site.example/api/subscribe",
        data: JSON.stringify({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID }),
        headers: { cookie: `vr_attr=${EMAIL_SENTINEL}` },
      },
    };
    assert.ok(JSON.stringify(raw).includes(EMAIL_SENTINEL), "control: the raw event holds the sentinel");
    const sent = call.eventProcessors.reduce((event, processor) => processor(event), raw);
    assert.ok(!JSON.stringify(sent).includes(EMAIL_SENTINEL), "no breadcrumb or request field may carry the address");
    assert.deepEqual(sent.request, { method: "POST", url: "https://site.example/api/subscribe" });
    assert.deepEqual(sent.breadcrumbs, []);
    assert.equal(sent.message, call.message, "the event itself survives");
    assert.deepEqual(sent.tags, raw.tags, "the tags survive");
  }

  function assertNoSentinelInCaptures() {
    const captured = JSON.stringify(sentry.captureCalls);
    assert.ok(captured.length > 2, "control: there is a capture to search");
    assert.ok(!captured.includes(EMAIL_SENTINEL), "the address must never reach Sentry");
    assert.ok(!captured.includes("Refused"), "the upstream body must never reach Sentry");
    for (const call of sentry.captureCalls) assertEventIsScrubbed(call);
  }

  t.beforeEach(() => sentry.reset());
  t.afterEach(() => {
    globalThis.fetch = realFetch;
  });
  t.after(() => {
    if (realSiteId === undefined) delete process.env.SITE_ID;
    else process.env.SITE_ID = realSiteId;
  });

  await t.test("REFUSE: an upstream 400 answers 500 and sends one status-only capture", async () => {
    mockUpstream(rejectQuotingTheEmail(400));

    const res = await postAndWaitForFlush({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID });

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Subscribe failed." });
    assert.equal(sentry.captureCalls[0].message, "newsletter sign-up rejected, subscriber not stored");
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.subscribe.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected", status: "400" },
    });
    assert.equal(upstreamBodies.length, 1);
    assert.ok(upstreamBodies[0].includes(EMAIL_SENTINEL), "control: the sentinel really went upstream");
    assertNoSentinelInCaptures();
  });

  await t.test("REFUSE: a repeat of the same failure inside the window is not captured again", async () => {
    mockUpstream(rejectQuotingTheEmail(400));

    const res = await POST(fakeRequest({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID }));

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Subscribe failed." });
    assert.equal(upstreamBodies.length, 1, "control: the upstream really refused again");
    assert.equal(sentry.captureCalls.length, 0, "throttled: one event per kind per window");
    assert.equal(sentry.flushCalls.length, 0, "nothing queued, nothing to flush");
  });

  await t.test("REFUSE: a different status is its own kind and is still captured",async () => {
    mockUpstream(rejectQuotingTheEmail(502));

    const res = await postAndWaitForFlush({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID });

    assert.equal(res.status, 500);
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.subscribe.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected", status: "502" },
    });
    assertNoSentinelInCaptures();
  });

  await t.test("REFUSE: no upstream answer at all is captured without a status", async () => {
    mockUpstream(async () => {
      throw new TypeError("fetch failed");
    });

    const res = await postAndWaitForFlush({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID });

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Subscribe failed." });
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.subscribe.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected" },
    });
    assertNoSentinelInCaptures();
  });

  await t.test("REFUSE: a missing collectionId answers the same 400 and sends one capture", async () => {
    mockUpstream(async () => {
      throw new Error("no upstream call expected");
    });

    const res = await postAndWaitForFlush({ email: EMAIL_SENTINEL });

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, message: "Missing collectionId." });
    assert.equal(upstreamBodies.length, 0, "refused before any upstream call");
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.subscribe.rejected"],
      tags: { siteId: SITE_ID, stage: "missing-collection" },
    });
    assertNoSentinelInCaptures();
  });

  await t.test("ALLOW: an upstream 2xx answers 200 with no capture and no flush", async () => {
    mockUpstream(
      async () =>
        new Response(JSON.stringify({ success: true, data: { _id: "x" } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );

    const res = await POST(fakeRequest({ email: EMAIL_SENTINEL, collectionId: COLLECTION_ID }));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assert.equal(upstreamBodies.length, 1);
    assert.ok(upstreamBodies[0].includes(EMAIL_SENTINEL), "control: the sign-up really went upstream");
    assert.equal(sentry.captureCalls.length, 0);
    assert.equal(sentry.flushCalls.length, 0);
  });

  await t.test("ALLOW: an invalid email answers the same 400 with no capture and no upstream call", async () => {
    mockUpstream(async () => {
      throw new Error("no upstream call expected");
    });

    const res = await POST(fakeRequest({ email: "not-an-address", collectionId: COLLECTION_ID }));

    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { success: false, message: "Invalid email." });
    assert.equal(upstreamBodies.length, 0);
    assert.equal(sentry.captureCalls.length, 0, "visitor-correctable, not reported");
    assert.equal(sentry.flushCalls.length, 0);
  });
});
