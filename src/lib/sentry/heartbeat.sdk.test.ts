import { test } from "node:test";
import assert from "node:assert/strict";
import { register as registerLoader } from "node:module";

// Scoped to THIS file's process (`node --test` runs each file in its own
// child): `@sentry/nextjs` is the REAL SDK with an in-memory transport
// (`../api/testSupport/realSentryLoader.mjs`, `../api/testSupport/realSentry.mjs`).
registerLoader(new URL("../api/testSupport/realSentryLoader.mjs", import.meta.url).href);

/**
 * SW-9 (hotfix 2026-11-13, vivreal-hq hotfix plan T-3, F263, owner OD-3): the
 * server sends ONE Sentry Logs line per process start, `service.started` with
 * `{ service: "Vivreal_Templates", release: <40-hex> }`, and no other
 * `Sentry.logger` line leaves (`beforeSendLog` allowlist).
 *
 * Driven end to end: the repo's own `register()` from `src/instrumentation.ts`
 * (Node runtime) initialises the installed SDK, and each serialized envelope
 * the SDK would have sent is read back. The release is the one the build
 * writes (`_sentryRelease`, SW-10, next.config.ts), which the SDK's Node init
 * reports (`@sentry/nextjs` `server/index.js`).
 *
 * Red at d4d67593 (this file and the `logger` export of realSentry.mjs only):
 * logs were off (`enableLogs: false`), so no heartbeat left (ALLOW), and the
 * init carried no `beforeSendLog`, so any line the SDK captured would have
 * left unchanged (REFUSE, the hook row). The pipeline REFUSE is a pin: with
 * logs off nothing left at d4d67593 either.
 *
 * `register()` runs once in this process: `@sentry/nextjs` ignores a second
 * `init` (`server/index.js`, `sdkAlreadyInitialized`).
 */

const RELEASE = "d4d675932a59e51fafa9f1442aed2e8a12175c8d";

/** One serialized Sentry Logs item, as it would have left the process. */
interface SentLog {
  level: string;
  body: string;
  attributes: Record<string, { value: unknown; type: string } | undefined>;
}

/** Shape `../api/testSupport/realSentry.mjs` exposes beside the real SDK functions. */
interface RealSentryModule {
  flush(timeout?: number): Promise<boolean>;
  logger: {
    trace(message: unknown, attributes?: Record<string, unknown>): void;
    debug(message: unknown, attributes?: Record<string, unknown>): void;
    info(message: unknown, attributes?: Record<string, unknown>): void;
    warn(message: unknown, attributes?: Record<string, unknown>): void;
    error(message: unknown, attributes?: Record<string, unknown>): void;
    fatal(message: unknown, attributes?: Record<string, unknown>): void;
    fmt(strings: TemplateStringsArray, ...values: unknown[]): unknown;
  };
  __realSentryControl: { readonly envelopes: readonly string[]; readonly initOptions: Record<string, unknown> };
}

/** Every log item in `envelopes`, in order. */
function sentLogs(envelopes: readonly string[]): SentLog[] {
  return envelopes.flatMap((raw) => {
    const lines = raw.split("\n");
    const logs: SentLog[] = [];
    for (let i = 1; i + 1 < lines.length; i += 2) {
      const itemHeader = JSON.parse(lines[i] || "{}") as { type?: string };
      if (itemHeader.type === "log") logs.push(...(JSON.parse(lines[i + 1]) as { items: SentLog[] }).items);
    }
    return logs;
  });
}

process.env.NEXT_RUNTIME = "nodejs";
// `realSentry.mjs` swaps the transport for an in-memory one, and the .invalid
// host (RFC 2606) cannot resolve if that swap is ever removed.
process.env.NEXT_PUBLIC_SENTRY_DSN = "https://public@sentry.invalid/0";
process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT = "production";
process.env._sentryRelease = RELEASE;

const { register } = await import("../../instrumentation.ts");
const Sentry = (await import("@sentry/nextjs")) as unknown as RealSentryModule;

test("ALLOW (red at d4d67593): a server start sends exactly one service.started line naming the release", async () => {
  await register();
  await Sentry.flush(2_000);
  const logs = sentLogs(Sentry.__realSentryControl.envelopes);
  assert.equal(logs.length, 1, "one heartbeat per process start");
  assert.equal(logs[0].body, "service.started");
  assert.equal(logs[0].level, "info");
  assert.equal(logs[0].attributes.service?.value, "Vivreal_Templates");
  assert.equal(logs[0].attributes.release?.value, RELEASE);
  assert.match(String(logs[0].attributes.release?.value), /^[0-9a-f]{40}$/);
});

test("REFUSE (red at d4d67593): the server init drops every Sentry Logs line but the heartbeat", () => {
  const options = Sentry.__realSentryControl.initOptions as {
    enableLogs?: boolean;
    beforeSendLog?: (log: { level: string; message: unknown; attributes?: object }) => object | null;
  };
  // How the SDK treats a captured line: through `beforeSendLog` when the init
  // set one, unchanged when it did not (`@sentry/core` 10.75.3
  // `logs/internal.js:84`). At d4d67593 there was no hook.
  const asTheSdkApplies = (log: { level: string; message: unknown; attributes?: object }) =>
    options.beforeSendLog ? options.beforeSendLog(log) : log;
  for (const message of [
    "page.rendered",
    "kx9warn",
    "service.started ",
    "Service.started",
    "service.started.extra",
    // The heartbeat's words as a parameterised line (`Sentry.logger.fmt`).
    Object.assign(new String("service.started"), { __sentry_template_string__: "service.started" }),
  ]) {
    assert.equal(asTheSdkApplies({ level: "info", message, attributes: { email: "kx9email@visitor.example" } }), null, String(message));
  }
  const heartbeat = { level: "info", message: "service.started", attributes: { service: "Vivreal_Templates" } };
  assert.equal(asTheSdkApplies(heartbeat), heartbeat, "the heartbeat itself passes");
  assert.equal(options.enableLogs, true, "logs are on (for the heartbeat), so the allowlist is the only door");
});

test("REFUSE (pin): after a server start, no Sentry.logger or console line but the heartbeat leaves the process", async () => {
  // A pin, not a red: at d4d67593 logs were off, so nothing left at all. It
  // drives the whole pipeline at today's options: every level, a look-alike,
  // and the console (no console integration sends logs).
  const before = Sentry.__realSentryControl.envelopes.length;
  Sentry.logger.info("page.rendered", { email: "kx9email@visitor.example", path: "/kx9path" });
  Sentry.logger.warn("kx9warn");
  Sentry.logger.error("kx9error", { phone: "+14155550109" });
  Sentry.logger.trace("kx9trace");
  Sentry.logger.debug("kx9debug");
  Sentry.logger.fatal("kx9fatal");
  Sentry.logger.info(Sentry.logger.fmt`service.started ${"kx9fmt"}`);
  console.log("kx9console log");
  console.warn("kx9console warn");
  await Sentry.flush(2_000);

  const sentAfter = Sentry.__realSentryControl.envelopes.slice(before);
  assert.deepEqual(sentLogs(sentAfter), [], "no log line but the heartbeat leaves");
  for (const raw of sentAfter) assert.ok(!raw.includes("kx9"), `a dropped line's content left: ${raw.slice(0, 200)}`);
  // Positive control: the same reader finds the heartbeat sent at start.
  assert.equal(sentLogs(Sentry.__realSentryControl.envelopes).length, 1);
});
