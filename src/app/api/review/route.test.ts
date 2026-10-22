import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child). The subscribe route's loader resolves everything this route needs;
// see `../subscribe/testSupport/routeLoader.mjs` for what it fakes and why.
register(new URL("../subscribe/testSupport/routeLoader.mjs", import.meta.url).href);

/**
 * vivreal-hq review-templates204-delta-2026-10-21.md: a failing
 * `/tenant/definedCollectionObject` write used to be logged and swallowed, so
 * a lost review left nothing in Sentry. These drive the real `POST()` and the
 * real `createReview` + `doClientFetch` against a mocked upstream `fetch`,
 * and read what reached the Sentry stub.
 */

/** Never allowed in any capture. The controls below prove each really travels. */
const EMAIL_SENTINEL = "sentinel-review-5e1d@reviewer.example";
const NAME_SENTINEL = "Sentinel Reviewername 9b4c";
const TEXT_SENTINEL = "sentinel review text 2f8a, loved it";
const SENTINELS = [EMAIL_SENTINEL, NAME_SENTINEL, TEXT_SENTINEL];
const COLLECTION_ID = "65f0c0ffee0000000000dcba";
const SITE_ID = "review-test-site";

const REVIEW_BODY = {
  email: EMAIL_SENTINEL,
  name: NAME_SENTINEL,
  review: TEXT_SENTINEL,
  rating: 4.5,
  collectionId: COLLECTION_ID,
};

/** The route only calls `.json()` on its request. */
function fakeRequest(body: unknown): Request {
  // Duck-typed on purpose: `.json()` is all `POST` reads.
  return { json: async () => body } as unknown as Request;
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

test("/api/review reports a lost review to Sentry, never the visitor's details", async (t) => {
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
  const rejectQuotingTheReview = (status: number) => async () =>
    new Response(JSON.stringify({ success: false, error: `Refused ${SENTINELS.join(" / ")}` }), {
      status,
      headers: { "content-type": "application/json" },
    });

  function assertSentinelsWentUpstream() {
    assert.equal(upstreamBodies.length, 1);
    for (const sentinel of SENTINELS) {
      assert.ok(upstreamBodies[0].includes(sentinel), `control: ${sentinel} really went upstream`);
    }
  }

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
   * On Node the SDK adds the incoming body as `request.data` and every
   * console line of the request as a breadcrumb. Run the capture's own scope
   * processors over an event that holds every sentinel in each of those
   * places, the way the SDK runs them last.
   */
  function assertEventIsScrubbed(call: (typeof sentry.captureCalls)[number]) {
    assert.equal(call.eventProcessors.length, 1, "the capture must be made inside the scrubbing scope");
    const quoted = SENTINELS.join(" / ");
    const raw: SyntheticEvent = {
      message: call.message,
      tags: { stage: "upstream-rejected" },
      breadcrumbs: [{ category: "console", message: `[createReview] error: ApiError: Refused ${quoted}` }],
      request: {
        method: "POST",
        url: `https://site.example/api/review?ref=${EMAIL_SENTINEL}`,
        data: JSON.stringify(REVIEW_BODY),
        headers: { cookie: `vr_attr=${NAME_SENTINEL}` },
      },
    };
    const sent = call.eventProcessors.reduce((event, processor) => processor(event), raw);
    for (const sentinel of SENTINELS) {
      assert.ok(JSON.stringify(raw).includes(sentinel), `control: the raw event holds ${sentinel}`);
      assert.ok(!JSON.stringify(sent).includes(sentinel), `no breadcrumb or request field may carry ${sentinel}`);
    }
    assert.deepEqual(sent.request, { method: "POST", url: "https://site.example/api/review" });
    assert.deepEqual(sent.breadcrumbs, []);
    assert.equal(sent.message, call.message, "the event itself survives");
    assert.deepEqual(sent.tags, raw.tags, "the tags survive");
  }

  function assertNoSentinelInCaptures() {
    const captured = JSON.stringify(sentry.captureCalls);
    assert.ok(captured.length > 2, "control: there is a capture to search");
    for (const sentinel of SENTINELS) {
      assert.ok(!captured.includes(sentinel), `${sentinel} must never reach Sentry`);
    }
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

  await t.test("REFUSE: an upstream 429 answers the same 500 and sends one status-only capture", async () => {
    mockUpstream(rejectQuotingTheReview(429));

    const res = await postAndWaitForFlush(REVIEW_BODY);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Failed to create review" });
    assert.equal(sentry.captureCalls[0].message, "site review rejected, review not stored");
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.review.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected", status: "429" },
    });
    assertSentinelsWentUpstream();
    assertNoSentinelInCaptures();
  });

  await t.test("REFUSE: a repeat of the same failure inside the window is not captured again", async () => {
    mockUpstream(rejectQuotingTheReview(429));

    const res = await POST(fakeRequest(REVIEW_BODY));

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Failed to create review" });
    assertSentinelsWentUpstream();
    assert.equal(sentry.captureCalls.length, 0, "throttled: one event per status per window");
    assert.equal(sentry.flushCalls.length, 0, "nothing queued, nothing to flush");
  });

  await t.test("REFUSE: a different status is its own kind and is still captured", async () => {
    mockUpstream(rejectQuotingTheReview(502));

    const res = await postAndWaitForFlush(REVIEW_BODY);

    assert.equal(res.status, 500);
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.review.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected", status: "502" },
    });
    assertNoSentinelInCaptures();
  });

  await t.test("REFUSE: no upstream answer at all is captured without a status", async () => {
    mockUpstream(async () => {
      throw new TypeError("fetch failed");
    });

    const res = await postAndWaitForFlush(REVIEW_BODY);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Failed to create review" });
    assert.deepEqual(sentry.captureCalls[0].context, {
      level: "error",
      fingerprint: ["templates.review.rejected"],
      tags: { siteId: SITE_ID, stage: "upstream-rejected" },
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

    const res = await POST(fakeRequest(REVIEW_BODY));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true });
    assertSentinelsWentUpstream();
    assert.equal(sentry.captureCalls.length, 0);
    assert.equal(sentry.flushCalls.length, 0);
  });

  await t.test("ALLOW: a body that is not JSON answers the same 500 with no capture", async () => {
    mockUpstream(async () => {
      throw new Error("no upstream call expected");
    });

    const res = await POST({
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Request);

    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: "Server error" });
    assert.equal(upstreamBodies.length, 0);
    assert.equal(sentry.captureCalls.length, 0, "a malformed request is not a lost review");
    assert.equal(sentry.flushCalls.length, 0);
  });
});
