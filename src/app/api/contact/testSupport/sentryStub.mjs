// Controllable fake for `@sentry/nextjs`, loaded ONLY through
// `routeLoader.mjs` (see its header for why the real package is not used).
// `route.ts` and the test that drives it both import "@sentry/nextjs" — the
// loader resolves both to this SAME file, and ESM caches a module per
// resolved URL, so they share this one instance. That is what lets the test
// observe calls `route.ts` makes and control when `flush()` settles, without
// either side needing to know the other exists.
let flushCalls = [];
let captureCalls = [];
let exceptionCalls = [];
let pendingFlush = null;

export function captureMessage(message, context) {
  captureCalls.push({ message, context, at: Date.now() });
}

// P2-1 (review-templates-184.md pass 2): route.ts calls this from its catch
// block so a response-swallowed throw is still recorded, the same way
// Sentry's own route-handler instrumentation would have recorded it had the
// throw been allowed to reach Next instead.
export function captureException(err) {
  exceptionCalls.push({ err, at: Date.now() });
}

export function flush(timeout) {
  flushCalls.push({ timeout, at: Date.now() });
  if (!pendingFlush) {
    let resolve;
    const promise = new Promise((res) => {
      resolve = res;
    });
    pendingFlush = { promise, resolve };
  }
  return pendingFlush.promise;
}

/** Test-only control surface. Never imported by route.ts. */
export const __sentryStubControl = {
  get flushCalls() {
    return flushCalls;
  },
  get captureCalls() {
    return captureCalls;
  },
  get exceptionCalls() {
    return exceptionCalls;
  },
  /** Settle the (one, shared) pending `flush()` call, or pre-seed the
   * result if `flush()` has not been called yet. */
  resolveFlush(value = true) {
    if (!pendingFlush) {
      pendingFlush = { promise: Promise.resolve(value), resolve: () => {} };
      return;
    }
    pendingFlush.resolve(value);
  },
  reset() {
    flushCalls = [];
    captureCalls = [];
    exceptionCalls = [];
    pendingFlush = null;
  },
};
