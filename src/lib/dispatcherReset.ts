/**
 * Evicts the shared keep-alive connection pool the first time this process is
 * seen again after a long idle gap, so the first request after an Amplify
 * freeze opens a fresh connection instead of reusing a socket that died while
 * nothing could answer it.
 *
 * WHY THIS EXISTS (idle-dead-socket-research-2026-10-04.md, section 2d)
 * -----------------------------------------------------------------------
 * A local reproduction proved one concrete failure shape: when at least 3x
 * concurrency worth of pooled sockets are dead at once, undici's pool hands a
 * retry to the SAME dead client that just failed (it is the next idle one in
 * insertion order), so every attempt dies in about 1ms and no new connection
 * is ever opened. That is the exact signature measured live at Waves of
 * Grain 2026-10-04 22:28:24 (12 attempts, 5ms, terminal `write ETIMEDOUT`).
 * Retrying with a backoff (`./api/fetchWithReconnect.ts`) does not fix this
 * shape, because every attempt is handed the same dead client. Evicting the
 * pool before the first attempt does.
 *
 * WHY THE GLOBAL DISPATCHER, AND WHY NO NEW DEPENDENCY
 * -----------------------------------------------------
 * Next's edge runtime and Node's own global `fetch` both publish their
 * default Agent at the SAME well-known symbol, `Symbol.for`
 * `('undici.globalDispatcher.1')`, which is undici's own documented
 * mechanism for sharing one dispatcher across module realms
 * (`node_modules/next/dist/compiled/@edge-runtime/primitives/load.js:11168-11187`).
 * One reset here reaches every fetch client.vivreal.io gets in this process,
 * from edge middleware through the Node-runtime page render that follows it
 * in the same invocation.
 *
 * Templates carries no `undici` dependency, and `node:undici` does not exist
 * as a public Node specifier (verified empirically against Node 22.20.0: the
 * import throws `ERR_UNKNOWN_BUILTIN_MODULE`), so there is no `Agent`
 * constructor to import and build a replacement with. The existing instance
 * already carries one: `current.constructor` IS the Agent class, so the
 * replacement below is built reflectively off the symbol we already hold.
 * Also verified empirically: the global slot is `writable` but NOT
 * `configurable`, so it can be REASSIGNED but never deleted — after
 * `destroy()`, a later `fetch()` through the stale reference fails outright
 * (`TypeError: fetch failed`) rather than lazily rebuilding itself, so a
 * reset that destroys the old instance must install a replacement in the
 * same turn or it breaks every later fetch in the process.
 *
 * THRESHOLD
 * ---------
 * Amplify freezes the process between EVERY request on a given container, so
 * strictly speaking every idle gap is "a freeze". The failures this research
 * measured all followed 18.5s to 504.5s of idle; the shortest gap between a
 * clean invocation and the next was 97ms, and ordinary same-page asset
 * waterfalls cluster in well under a second. `THAW_RESET_THRESHOLD_MS` sits
 * comfortably under the shortest confirmed failure and comfortably over
 * ordinary request clustering, so a warm burst pays zero reset cost (the
 * whole reason to prefer this over disabling keep-alive outright), and only
 * a gap long enough to plausibly be a real freeze forces a fresh handshake —
 * one that was likely required anyway, since the pooled socket is this stale.
 * Tune from `./api/fetchWithReconnect.ts`'s per-attempt log once deployed.
 */
export const THAW_RESET_THRESHOLD_MS = 5_000;

const GLOBAL_DISPATCHER_SYMBOL = Symbol.for('undici.globalDispatcher.1');

interface DestroyableDispatcher {
  destroy(): unknown;
}

/** `as`: the global dispatcher is stored under a well-known Symbol key, which
 * TypeScript's `typeof globalThis` has no index signature for. This is the
 * same reflective access pattern undici itself uses to share the instance
 * across realms (see the module header). */
function dispatcherSlot(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

let lastSeenAt: number | null = null;
let lastResetAt: number | null = null;
let resetCount = 0;

/**
 * Call once near the start of every request (today: the first line of
 * `src/middleware.ts`, which Next runs on every request with no `matcher`
 * configured). Returns whether a reset actually happened, for tests and
 * diagnostics; production callers do not need the return value.
 */
export function noteRequestAndMaybeResetDispatcher(now: () => number = Date.now): boolean {
  const nowMs = now();
  const previous = lastSeenAt;
  lastSeenAt = nowMs;

  // First invocation this process has seen (cold start): nothing pooled yet
  // to be stale, and nothing to compare against.
  if (previous === null) return false;
  if (nowMs - previous < THAW_RESET_THRESHOLD_MS) return false;

  const slot = dispatcherSlot();
  const current = slot[GLOBAL_DISPATCHER_SYMBOL] as DestroyableDispatcher | undefined;
  // No dispatcher has been created yet (no fetch has run in this process) —
  // nothing pooled, nothing to reset.
  if (!current || typeof current.destroy !== 'function') return false;

  try {
    void current.destroy();
    // `as`: reflective construction off the live instance's own constructor —
    // see the module header for why this is the only dependency-free way to
    // get a working replacement.
    const Ctor = (current as unknown as { constructor: new () => DestroyableDispatcher }).constructor;
    slot[GLOBAL_DISPATCHER_SYMBOL] = new Ctor();
    lastResetAt = nowMs;
    resetCount += 1;
    return true;
  } catch {
    // Never let a reset attempt break the request it exists to protect. Worst
    // case: the stale Agent survives and fetchWithReconnect's post-thaw
    // backoff is what covers this request instead.
    return false;
  }
}

/**
 * For `fetchWithReconnect`'s per-attempt log: how long ago (if ever) this
 * process last reset the pool, so a recovered attempt can be read against
 * "did we just force a fresh connection" rather than guessed at.
 */
export function getDispatcherResetInfo(now: () => number = Date.now): {
  msSinceDispatcherReset?: number;
  dispatcherResetCount?: number;
} {
  if (lastResetAt === null) return {};
  return { msSinceDispatcherReset: now() - lastResetAt, dispatcherResetCount: resetCount };
}

/** Test-only: module state otherwise persists for the life of the process,
 * exactly like the production container it is modeling. */
export function __resetDispatcherStateForTests(): void {
  lastSeenAt = null;
  lastResetAt = null;
  resetCount = 0;
}
