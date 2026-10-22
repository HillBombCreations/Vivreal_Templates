import { test } from "node:test";
import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child). The subscribe route's loader, with `@sentry/nextjs` left REAL; see
// `testSupport/realSentryLoader.mjs` and `testSupport/realSentry.mjs`.
registerLoader(new URL("./testSupport/realSentryLoader.mjs", import.meta.url).href);

/**
 * vivreal-hq review-templates204-delta-2026-10-21.md, C1 and C2. The route
 * tests run the scrub over a synthetic event through a Sentry stub, which
 * cannot show what the SDK itself attaches, or that a scope processor runs
 * after it does. This drives the installed SDK end to end: the repo's own
 * `register()` from `src/instrumentation.ts`, a real node http server, the
 * real subscribe and review routes inside its request handler, and an
 * in-memory transport in place of the network.
 *
 * The control capture is made in the same kind of request with no scrub, and
 * must carry the visitor's details in both places the SDK puts them (the
 * request body as `request.data`, the `console.error` lines as breadcrumbs).
 * Without that, an absent sentinel would prove nothing. If an SDK upgrade
 * changes the processor order or adds a new place for the body, this fails.
 */

const EMAIL_SENTINEL = "sentinel-sdk-4d2e@subscriber.example";
const NAME_SENTINEL = "Sentinel Sdkname 7c1f";
const TEXT_SENTINEL = "sentinel sdk review text 0a9b";
const REVIEW_SENTINELS = [EMAIL_SENTINEL, NAME_SENTINEL, TEXT_SENTINEL];
const COLLECTION_ID = "65f0c0ffee0000000000beef";
const SITE_ID = "sdk-scrub-test-site";
/** `testSupport/clientStub.mjs`'s upstream base. */
const CLIENT_API_BASE_URL = "https://client-api.test";

/** Shape `testSupport/realSentry.mjs` exposes beside the real SDK functions. */
interface RealSentryModule {
  SDK_VERSION: string;
  close(timeout?: number): Promise<boolean>;
  captureMessage(message: string, context?: Record<string, unknown>): string;
  flush(timeout?: number): Promise<boolean>;
  __realSentryControl: {
    readonly envelopes: readonly string[];
    readonly initOptions: Record<string, unknown> | null;
  };
}

/** The parts of a sent event these assertions read. */
interface SentEvent {
  message?: string;
  tags?: Record<string, string>;
  breadcrumbs?: Array<{ category?: string; message?: string }>;
  request?: { method?: string; url?: string; data?: unknown };
}

type RouteModule = { POST(req: Request): Promise<{ status: number; body: unknown }> };

/** Each envelope with the event item it carries (header, item header, item). */
function sentEvents(envelopes: readonly string[]): Array<{ raw: string; event: SentEvent }> {
  return envelopes.flatMap((raw) => {
    const lines = raw.split("\n");
    const itemHeader = JSON.parse(lines[1] ?? "{}") as { type?: string };
    if (itemHeader.type !== "event") return [];
    return [{ raw, event: JSON.parse(lines[2]) as SentEvent }];
  });
}

const envKeys = ["NEXT_RUNTIME", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_ENVIRONMENT", "SITE_ID"] as const;
const realEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

test("the shared scrub strips a visitor's details from what the real Sentry SDK sends", async (t) => {
  process.env.NEXT_RUNTIME = "nodejs";
  // Never dialled: `realSentry.mjs` swaps the transport for an in-memory one.
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@o0.ingest.sentry.io/0";
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "production";
  process.env.SITE_ID = SITE_ID;

  const { register } = await import("../../instrumentation.ts");
  await register();
  // See `RealSentryModule`: the loader resolves this to `realSentry.mjs`.
  const Sentry = (await import("@sentry/nextjs")) as unknown as RealSentryModule;
  const { POST: subscribePOST } = (await import("../../app/api/subscribe/route.tsx")) as unknown as RouteModule;
  const { POST: reviewPOST } = (await import("../../app/api/review/route.tsx")) as unknown as RouteModule;
  const http = await import("node:http");

  const realFetch = globalThis.fetch;
  // The far upstream refuses, quoting what it was sent, the way a validation
  // error can. `subscribeUser` and `createReview` log that text.
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (!url.startsWith(CLIENT_API_BASE_URL)) return realFetch(input, init);
    return new Response(JSON.stringify({ success: false, error: `Refused ${String(init?.body)}` }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  /**
   * The body is awaited from INSIDE the request handler, the way Next's own
   * handler reads it. The SDK starts the request's isolation scope around
   * `emit("request")`, and async context follows an `await`, not an emitter:
   * a capture made in a bare `req.on("end")` callback runs outside that scope
   * and would carry no request at all, so the control would prove nothing.
   */
  async function handle(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
    const body = await new Promise<string>((resolve, reject) => {
      let text = "";
      req.on("data", (chunk) => {
        text += chunk;
      });
      req.on("end", () => resolve(text));
      req.on("error", reject);
    });
    const parsed: unknown = JSON.parse(body);
    // Duck-typed: `.json()` and `.headers.get()` are all either route reads.
    const routeRequest = { json: async () => parsed, headers: { get: () => null } } as unknown as Request;
    const path = (req.url ?? "").split("?")[0];
    let status = 200;
    if (path === "/api/subscribe") status = (await subscribePOST(routeRequest)).status;
    else if (path === "/api/review") status = (await reviewPOST(routeRequest)).status;
    else {
      // CONTROL: the same kind of request and console line, captured with no scrub.
      console.error(`[control] error: ApiError: Refused ${body}`);
      Sentry.captureMessage("scrub control, unscrubbed", { level: "error", tags: { stage: "control" } });
      await Sentry.flush(2000);
    }
    res.statusCode = status;
    res.end();
  }
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      res.statusCode = 599;
      res.end(String(err));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert.ok(address && typeof address === "object", "the server is listening");
  const origin = `http://127.0.0.1:${address.port}`;

  async function post(pathWithQuery: string, body: unknown): Promise<number> {
    const res = await realFetch(`${origin}${pathWithQuery}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.status;
  }

  t.after(async () => {
    globalThis.fetch = realFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Sentry.close(2000);
    for (const key of envKeys) {
      if (realEnv[key] === undefined) delete process.env[key];
      else process.env[key] = realEnv[key];
    }
  });

  const subscribeBody = { email: EMAIL_SENTINEL, collectionId: COLLECTION_ID };
  const reviewBody = {
    email: EMAIL_SENTINEL,
    name: NAME_SENTINEL,
    review: TEXT_SENTINEL,
    rating: 5,
    collectionId: COLLECTION_ID,
  };

  await t.test("the repo's own config initialises the SDK, enabled, with nothing scrubbing ahead of us", () => {
    const options = Sentry.__realSentryControl.initOptions;
    assert.ok(options, "src/instrumentation.ts called init");
    assert.equal(Sentry.SDK_VERSION, "10.75.3", "the installed SDK this was proved against; re-run on a bump");
    assert.equal(options.enabled, true, "control: the SDK really sends");
    assert.equal(options.sendDefaultPii, undefined, "the repo leaves sendDefaultPii at its default");
    assert.equal(options.beforeSend, undefined, "no beforeSend hides or adds anything");
  });

  await t.test("CONTROL: without the scrub the SDK sends the body and the console line", async () => {
    assert.equal(await post(`/control?ref=${EMAIL_SENTINEL}`, reviewBody), 200);

    const control = sentEvents(Sentry.__realSentryControl.envelopes).filter(
      ({ event }) => event.message === "scrub control, unscrubbed",
    );
    assert.equal(control.length, 1, "one control event was sent");
    const { raw, event } = control[0];
    for (const sentinel of REVIEW_SENTINELS) {
      assert.ok(raw.includes(sentinel), `control: ${sentinel} is in the unscrubbed envelope`);
    }
    assert.ok(JSON.stringify(event.request?.data).includes(EMAIL_SENTINEL), "control: the body rides in request.data");
    assert.ok(
      (event.breadcrumbs ?? []).some((crumb) => crumb.category === "console" && crumb.message?.includes(EMAIL_SENTINEL)),
      "control: the console.error line rides as a breadcrumb",
    );
    assert.ok(JSON.stringify(event.request).includes(`ref=${EMAIL_SENTINEL}`), "control: the query rides on the request (C2)");
  });

  await t.test("REFUSE: a lost sign-up reaches Sentry with no address anywhere in the envelope", async () => {
    assert.equal(await post(`/api/subscribe?ref=${EMAIL_SENTINEL}`, subscribeBody), 500);

    const sent = sentEvents(Sentry.__realSentryControl.envelopes).filter(
      ({ event }) => event.message === "newsletter sign-up rejected, subscriber not stored",
    );
    assert.equal(sent.length, 1, "the route sent its capture");
    const { raw, event } = sent[0];
    assert.ok(!raw.includes(EMAIL_SENTINEL), "the address is nowhere in the envelope");
    assert.ok(!raw.includes("Refused"), "the upstream body is nowhere in the envelope");
    assert.deepEqual(event.request, { method: "POST", url: `${origin}/api/subscribe` }, "method and query-free URL only");
    assert.deepEqual(event.breadcrumbs ?? [], []);
    assert.equal(event.tags?.stage, "upstream-rejected");
    assert.equal(event.tags?.status, "400");
  });

  await t.test("REFUSE: a lost review reaches Sentry with no email, name or text anywhere in the envelope", async () => {
    assert.equal(await post(`/api/review?ref=${EMAIL_SENTINEL}`, reviewBody), 500);

    const sent = sentEvents(Sentry.__realSentryControl.envelopes).filter(
      ({ event }) => event.message === "site review rejected, review not stored",
    );
    assert.equal(sent.length, 1, "the route sent its capture");
    const { raw, event } = sent[0];
    for (const sentinel of REVIEW_SENTINELS) {
      assert.ok(!raw.includes(sentinel), `${sentinel} is nowhere in the envelope`);
    }
    assert.ok(!raw.includes("Refused"), "the upstream body is nowhere in the envelope");
    assert.deepEqual(event.request, { method: "POST", url: `${origin}/api/review` }, "method and query-free URL only");
    assert.deepEqual(event.breadcrumbs ?? [], []);
    assert.equal(event.tags?.stage, "upstream-rejected");
    assert.equal(event.tags?.status, "400");
  });
});
