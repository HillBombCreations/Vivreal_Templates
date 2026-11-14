import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { register as registerLoader } from "node:module";
import { httpHeadersToSpanAttributes } from "@sentry/core";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child): `@sentry/nextjs` resolves to the REAL SDK with an in-memory
// transport (`../api/testSupport/realSentry.mjs`).
registerLoader(new URL("../api/testSupport/realSentryLoader.mjs", import.meta.url).href);

/**
 * F220 (release A T-3, plan SW-A6): a SERVER event keeps only the listed
 * request headers. The deny list (`FLEET_SECRET_HEADERS`) named the
 * credentials the fleet knew about, so a header nobody listed rode on every
 * server event; the release check plants `x-planted-canary` to prove none
 * does (L-F220), and finds its own control event by `x-vr-check-control`.
 *
 * Driven end to end: the repo's own `register()` from `src/instrumentation.ts`,
 * a real node http server, the installed SDK, and an in-memory transport in
 * place of the network. A scope event processor records each event as the SDK
 * built it, BEFORE `beforeSend`: the canary there is the positive control that
 * the SDK really recorded it, so its absence from the envelope is the hook's
 * doing. The span attribute half calls each server runtime's own wired hooks
 * (Node and edge) with the SDK's own `http.request.header.*` attribute shape.
 *
 * The kept list is SW-A6 written out, the planned value, not read from the module.
 */
const SW_A6_KEPT = [
  "content-type", "content-length", "accept", "accept-encoding", "accept-language", "user-agent",
  "x-vr-check-control", "x-amzn-trace-id", "sentry-trace", "baggage",
];
const CANARY = `canary${randomBytes(8).toString("hex")}`;
const CONTROL = `control${randomBytes(8).toString("hex")}`;
/**
 * Not the canary: the Node SDK builds `request.url` from this header's value
 * (measured: `http://<x-forwarded-host>/probe`), and SW-A6 covers request
 * headers and their span attributes, not a URL the SDK derives from one. The
 * header itself is checked to be removed.
 */
const FORWARDED_HOST = "forwarded-host.example";

/** A request carrying the canary under several names nobody listed, plus kept headers. */
const PLANTED: Record<string, string> = {
  "x-planted-canary": CANARY,
  "x-forwarded-host": FORWARDED_HOST,
  "x-new-provider-signature": CANARY,
  referer: `https://shop.example/${CANARY}`,
  "x-vr-check-control": CONTROL,
  "user-agent": "allowlist-probe/1",
  "accept-language": "en-US",
  "content-type": "application/json",
};

interface SentEvent {
  message?: string;
  request?: { url?: string; headers?: Record<string, string> };
}

interface RealSentryModule {
  flush(timeout?: number): Promise<boolean>;
  captureMessage(message: string, context?: Record<string, unknown>): string;
  withScope<T>(callback: (scope: { addEventProcessor(p: (event: SentEvent) => SentEvent): void }) => T): T;
  __realSentryControl: {
    readonly envelopes: readonly string[];
    readonly initOptions: Record<string, unknown> | null;
  };
}

type Hook = (event: unknown, hint: unknown) => unknown;

function sentEvents(envelopes: readonly string[]): Array<{ raw: string; event: SentEvent }> {
  return envelopes.flatMap((raw) => {
    const lines = raw.split("\n");
    const itemHeader = JSON.parse(lines[1] ?? "{}") as { type?: string };
    if (itemHeader.type !== "event") return [];
    return [{ raw, event: JSON.parse(lines[2]) as SentEvent }];
  });
}

const envKeys = ["NEXT_RUNTIME", "NEXT_PUBLIC_SENTRY_DSN", "NEXT_PUBLIC_SENTRY_ENVIRONMENT"] as const;
const realEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function restoreEnv(): void {
  for (const key of envKeys) {
    if (realEnv[key] === undefined) delete process.env[key];
    else process.env[key] = realEnv[key];
  }
}

test("REFUSE (T-3): a header off SW-A6's list never leaves a Node server event; ALLOW: the listed ones do", async (t) => {
  t.after(restoreEnv);
  process.env.NEXT_RUNTIME = "nodejs";
  // The in-memory transport replaces the network, and .invalid (RFC 2606) cannot resolve if that swap is ever removed.
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/0";
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "production";

  const { register } = await import("../../instrumentation.ts");
  await register();
  const Sentry = (await import("@sentry/nextjs")) as unknown as RealSentryModule;
  const http = await import("node:http");

  const receivedCanary: string[] = [];
  const beforeHook: Array<Record<string, string>> = [];
  const server = http.createServer((req, res) => {
    void (async () => {
      receivedCanary.push(String(req.headers["x-planted-canary"] ?? ""));
      Sentry.withScope((scope) => {
        scope.addEventProcessor((event) => {
          beforeHook.push({ ...(event.request?.headers ?? {}) });
          return event;
        });
        Sentry.captureMessage("header allowlist probe", { level: "error" });
      });
      await Sentry.flush(2000);
      res.statusCode = 200;
      res.end();
    })().catch((err: unknown) => {
      res.statusCode = 599;
      res.end(String(err));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address === "object", "the server is listening");

  const res = await fetch(`http://127.0.0.1:${address.port}/probe`, { headers: PLANTED });
  assert.equal(res.status, 200);
  assert.deepEqual(receivedCanary, [CANARY], "control: the request really carried the canary");
  assert.equal(beforeHook.length, 1, "control: the SDK built one event for the request");
  assert.equal(beforeHook[0]["x-planted-canary"], CANARY, "control: the SDK recorded the canary before the hook ran");

  // Found the way L-F220 finds it: by the control header's value.
  const sent = sentEvents(Sentry.__realSentryControl.envelopes).filter(({ event }) => event.request?.headers?.["x-vr-check-control"] === CONTROL);
  assert.equal(sent.length, 1, "the control event was sent, carrying x-vr-check-control");
  const { raw, event } = sent[0];
  assert.ok(!raw.includes(CANARY), "the canary value is nowhere in the envelope");
  const headers = event.request?.headers ?? {};
  for (const name of Object.keys(headers)) assert.ok(SW_A6_KEPT.includes(name.toLowerCase()), `${name} left the process`);
  assert.equal(beforeHook[0]["x-forwarded-host"], FORWARDED_HOST, "control: the SDK recorded the forwarded host header");
  assert.equal("x-forwarded-host" in headers, false, "the forwarded host header is not on the list");
  assert.equal(headers["user-agent"], "allowlist-probe/1");
  assert.equal(headers["accept-language"], "en-US");
  assert.equal(event.message, "header allowlist probe");
});

test("REFUSE (T-3): the http.request.header.* attributes of a server transaction keep only SW-A6's names, Node and edge", async (t) => {
  t.after(restoreEnv);
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/0";
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "production";
  const { register } = await import("../../instrumentation.ts");
  const Sentry = (await import("@sentry/nextjs")) as unknown as RealSentryModule;

  const attributes = (): Record<string, unknown> => ({ "http.method": "GET", ...httpHeadersToSpanAttributes(PLANTED, false) });
  const planted = () => ({
    type: "transaction",
    transaction: "GET /probe",
    request: { url: "https://shop.example/probe", headers: { ...PLANTED } },
    contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16), data: attributes() } },
    spans: [{ span_id: "c".repeat(16), data: attributes() }],
  });
  assert.equal(planted().contexts.trace.data["http.request.header.x_planted_canary"], CANARY, "control: the SDK's attribute shape carries the canary");

  for (const runtime of ["nodejs", "edge"] as const) {
    process.env.NEXT_RUNTIME = runtime;
    await register();
    const options = Sentry.__realSentryControl.initOptions;
    assert.ok(options, `${runtime}: register() initialised the SDK`);
    assert.equal("integrations" in options, runtime === "nodejs", `control: this is the ${runtime} init`);
    for (const hookName of ["beforeSend", "beforeSendTransaction"] as const) {
      const hook = options[hookName] as Hook; // the init's own hook, checked to be a function next
      assert.equal(typeof hook, "function", `${runtime}: ${hookName} is wired`);
      const out = hook(planted(), {}) as ReturnType<typeof planted>;
      assert.ok(!JSON.stringify(out).includes(CANARY), `${runtime} ${hookName}: the canary is gone`);
      for (const data of [out.contexts.trace.data, out.spans[0].data]) {
        for (const key of Object.keys(data)) {
          const name = /^http\.request\.header\.([^.]+)/.exec(key)?.[1]?.replace(/_/g, "-");
          if (name) assert.ok(SW_A6_KEPT.includes(name), `${runtime} ${hookName}: ${key} left the process`);
        }
        assert.equal(data["http.request.header.x_vr_check_control"], CONTROL, `${runtime} ${hookName}: the control attribute stays`);
        assert.equal(data["http.request.header.user_agent"], "allowlist-probe/1", `${runtime} ${hookName}: the user agent stays`);
      }
      assert.deepEqual(Object.keys(out.request.headers).sort(), ["accept-language", "content-type", "user-agent", "x-vr-check-control"]);
    }
  }
});
