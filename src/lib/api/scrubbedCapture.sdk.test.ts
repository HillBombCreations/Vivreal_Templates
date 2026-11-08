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
 * The control capture is made in the same kind of request with no route
 * scrub, and must carry the visitor's details where the SDK still puts them
 * (the `console.error` lines as breadcrumbs). Without that, an absent sentinel
 * would prove nothing. If an SDK upgrade changes the processor order or adds
 * a new place for the body, this fails. Since the open-backlog release the
 * request BODY and the URL QUERY never ride on any event, route scrub or not
 * (the Node init turns the SDK's body reader off; the global hooks delete
 * `request.data` and `request.query_string` and cut the URL at its query);
 * `../sentry/requestBody.sdk.test.ts` proves that, and the control below now
 * asserts it too.
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
  // Never dialled: `realSentry.mjs` swaps the transport for an in-memory one,
  // and the .invalid host (RFC 2606) cannot resolve if that swap is ever removed.
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/0";
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

  await t.test("the repo's own config initialises the SDK, enabled, with only the credential, body and query scrub ahead of us", () => {
    const options = Sentry.__realSentryControl.initOptions;
    assert.ok(options, "src/instrumentation.ts called init");
    assert.equal(Sentry.SDK_VERSION, "10.75.3", "the installed SDK this was proved against; re-run on a bump");
    assert.equal(options.enabled, true, "control: the SDK really sends");
    // Next release 2026-11, plan 3.PII, T8 (owner Q14): explicit, never the default.
    assert.equal(options.sendDefaultPii, false, "sendDefaultPii is set false explicitly");
    // The global hooks remove credentials, the IP and (open-backlog release)
    // the request body and every URL query. A console line passes them
    // untouched, so the CONTROL below still proves the route scrub is what
    // removes that.
    for (const hook of ["beforeSend", "beforeSendTransaction"] as const) {
      const fn = options[hook] as ((e: unknown) => unknown) | undefined;
      assert.equal(typeof fn, "function", `${hook} is set`);
      const event = {
        request: { data: { email: EMAIL_SENTINEL }, headers: { cookie: "active_ctx=x", accept: "a" }, cookies: { active_ctx: "x" } },
        breadcrumbs: [{ category: "console", message: EMAIL_SENTINEL }],
        user: { ip_address: "203.0.113.9" },
      };
      assert.deepEqual(fn?.(event), {
        request: { headers: { accept: "a" } },
        breadcrumbs: [{ category: "console", message: EMAIL_SENTINEL }],
        user: {},
      }, `${hook} removes credentials, the IP, the body and the query, and nothing else`);
    }
    assert.equal(typeof options.beforeBreadcrumb, "function", "beforeBreadcrumb is set");
  });

  await t.test("CONTROL: without the route scrub the SDK sends the console line, and never the body or the query", async () => {
    assert.equal(await post(`/control?ref=${EMAIL_SENTINEL}`, reviewBody), 200);

    const control = sentEvents(Sentry.__realSentryControl.envelopes).filter(
      ({ event }) => event.message === "scrub control, unscrubbed",
    );
    assert.equal(control.length, 1, "one control event was sent");
    const { raw, event } = control[0];
    for (const sentinel of REVIEW_SENTINELS) {
      assert.ok(raw.includes(sentinel), `control: ${sentinel} is in the unscrubbed envelope`);
    }
    // Was "the body rides in request.data". The open-backlog release stops
    // that for every event (requestBody.sdk.test.ts), so the assertion turns
    // into its REFUSE; the sentinels above still ride, in the console line.
    assert.equal("data" in (event.request ?? {}), false, "no request body, even with no route scrub");
    assert.ok(
      (event.breadcrumbs ?? []).some((crumb) => crumb.category === "console" && crumb.message?.includes(EMAIL_SENTINEL)),
      "control: the console.error line rides as a breadcrumb",
    );
    // Was "the query rides on the request (C2)". Review P1 of the open-backlog
    // release makes the global hooks cut every URL query, so this turns into
    // its REFUSE as well; the sentinel still rides in the console line above.
    assert.equal(JSON.stringify(event.request).includes("ref="), false, "no URL query, even with no route scrub");
    assert.equal(event.request?.url, `${origin}/control`, "control: the request and its path still ride");
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

  await t.test("REFUSE (T8): a real request's cookies, fleet headers and IP never leave; a harmless header does", async () => {
    // Every fleet header and every session cookie, each with its own sentinel,
    // plus the release check's kept control header, through the real server,
    // the real SDK's request isolation scope and the real transport.
    // The fleet list, copied from plan 3.PII (Revision 26, 33 names) rather than
    // imported, so this real-SDK check does not lean on the module it proves;
    // `scrubCredentials.test.ts` pins the module's own array to the same 34.
    // Next release 2026-12 (plan RP-4, review-a-pr28 note 5) adds the 34th,
    // `cloudfront-viewer-address` (the viewer's `ip:port`), which the SDK's
    // HTTP server instrumentation records like any other request header.
    const FLEET_SECRET_HEADERS = [
      "cookie", "set-cookie", "authorization", "proxy-authorization",
      "x-active-ctx", "x-user-ctx", "x-api-key", "x-support-attestation",
      "x-csrf-token", "x-aws-waf-token", "x-amz-security-token", "x-amz-signature",
      "x-shopify-access-token", "x-dead-token-value", "x-github-stateless-s2s-token",
      "x-vivreal-preview", "x-vivreal-preview-token", "x-vivreal-signature", "x-vivreal-internal",
      "stripe-signature", "x-stripe-signature", "x-hub-signature-256",
      "x-shopify-hmac-sha256", "x-square-hmacsha256-signature", "x-vr-sentry-canary",
      "x-preview-token", "x-vr-metering-token", "x-revalidate-signature",
      "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "true-client-ip", "x-client-ip",
      "cloudfront-viewer-address",
    ];
    assert.equal(FLEET_SECRET_HEADERS.length, 34);
    const secret = (name: string) => `SENTINEL_${name.replace(/[^a-z0-9]/gi, "_")}_sdk_9d1e`;
    const cookieNames = ["token", "active_ctx", "user_ctx", "refreshToken", "csrf_token", "session", "sid", "zz_other", "vr-preview-token"];
    const headers: Record<string, string> = { "content-type": "application/json", "x-vr-check-control": "kept-control-9d1e" };
    for (const name of FLEET_SECRET_HEADERS) {
      // `fetch` forbids setting these two itself; the SDK reads them like any other header.
      if (name === "cookie" || name === "set-cookie") continue;
      headers[name] = secret(name);
    }
    headers.cookie = cookieNames.map((c) => `${c}=${secret(`cookie_${c}`)}`).join("; ");
    const sentinels = [
      ...FLEET_SECRET_HEADERS.filter((n) => n !== "cookie" && n !== "set-cookie").map(secret),
      ...cookieNames.map((c) => secret(`cookie_${c}`)),
    ];
    const res = await realFetch(`${origin}/control-credentials`, { method: "POST", headers, body: JSON.stringify({ ok: 1 }) });
    assert.equal(res.status, 200);

    const sent = sentEvents(Sentry.__realSentryControl.envelopes).filter(
      ({ event }) => event.message === "scrub control, unscrubbed" && String(event.request?.url ?? "").includes("/control-credentials"),
    );
    assert.equal(sent.length, 1, "one event for the credentials request");
    const { raw, event } = sent[0];
    const sentHeaders = (event.request as { headers?: Record<string, string> } | undefined)?.headers ?? {};
    // Positive control: the SDK recorded the request's headers at all.
    assert.equal(sentHeaders["x-vr-check-control"], "kept-control-9d1e", "control: the kept header rides on the event");
    for (const name of Object.keys(sentHeaders)) {
      assert.ok(!FLEET_SECRET_HEADERS.includes(name.toLowerCase()), `fleet header ${name} left the process`);
    }
    assert.equal("cookies" in (event.request ?? {}), false, "no request.cookies");
    for (const s of sentinels) assert.ok(!raw.includes(s), `${s} is in the envelope`);
    assert.ok(!/"ip_address"/.test(raw), "no IP address");
  });
});
