/**
 * V2 (next release, D15 "fix it small"): a short memo of FAILED upstream reads,
 * so an outage costs one upstream call per page request instead of two.
 *
 * WHY THE SECOND CALL HAPPENS. `unstable_cache` stores no throw, so on an
 * outage every `clientFetchCached` read goes upstream. The metadata read and the
 * render's read already share one call; the second call is the SAME read run
 * again in the separate render pass Next makes for the 500 response, which gets
 * a fresh React `cache` scope (`src/lib/renderComposedPage.tsx`, the
 * `composedPageIsEmpty` docblock, measured with `next start`). A request scoped
 * cache cannot reach that pass. Module scope can: both passes run in one
 * process.
 *
 * WHAT IT MEMOISES, AND WHAT IT NEVER DOES.
 * - Failures only, for `FAILURE_MEMO_MS`. Inside that window a read of the same
 *   key answers the caller's fallback without going upstream.
 * - A success is never memoised, and it clears any failure for its key, so a
 *   recovered API is read again at once.
 * - A failure the caller re-throws (a 402 quota answer, which the page must see
 *   as a throw) is never recorded, because the record happens only after the
 *   caller's handler RETURNED a fallback.
 *
 * ONE READ PER KEY AT A TIME (F-C13, QA-W7-1b). Concurrent reads of one key
 * in a single render (four `siteDetails` reads, measured) used to each miss
 * the memo, because a failure is recorded only after its read settles, so one
 * failed upstream call logged 4 fallbacks and sent 4 Sentry captures. A read
 * of a key that is already running now joins it: one upstream call, one
 * failure handler run (so one capture), and every joiner gets the same answer.
 *
 * NO `server-only` IMPORT, so the policy runs under `node --test`; `client.ts`
 * is the thin call site.
 */

/** How long a failed read is answered from the memo. */
export const FAILURE_MEMO_MS = 5_000;

/**
 * Bound on remembered keys. Keys are request paths, and a shop's search and
 * filter query strings make that set open ended, so it is capped rather than
 * trusted to stay small.
 */
export const FAILURE_MEMO_MAX_KEYS = 500;

export interface FailureMemo {
  hasRecentFailure(key: string): boolean;
  recordFailure(key: string): void;
  clear(key: string): void;
  readonly size: number;
  /**
   * Reads running right now, by key. An entry lives only while its read is in
   * flight (removed when it settles), so this is bounded by concurrency, not
   * by the key space.
   */
  readonly inFlight: Map<string, Promise<unknown>>;
}

/** What a shared read settled to: its value, or "failed, use your fallback". */
type SharedOutcome<T> = { ok: true; value: T } | { ok: false };

export function createFailureMemo({
  ttlMs = FAILURE_MEMO_MS,
  maxKeys = FAILURE_MEMO_MAX_KEYS,
  now = Date.now,
}: { ttlMs?: number; maxKeys?: number; now?: () => number } = {}): FailureMemo {
  const failedAt = new Map<string, number>();
  const inFlight = new Map<string, Promise<unknown>>();

  const sweepExpired = () => {
    const t = now();
    for (const [key, at] of failedAt) {
      if (t - at >= ttlMs) failedAt.delete(key);
    }
  };

  return {
    hasRecentFailure(key) {
      const at = failedAt.get(key);
      if (at === undefined) return false;
      if (now() - at < ttlMs) return true;
      failedAt.delete(key);
      return false;
    },
    recordFailure(key) {
      failedAt.delete(key);
      if (failedAt.size >= maxKeys) sweepExpired();
      // Still full of live entries: drop the oldest (Map keeps insertion order).
      if (failedAt.size >= maxKeys) {
        const oldest = failedAt.keys().next().value;
        if (oldest !== undefined) failedAt.delete(oldest);
      }
      failedAt.set(key, now());
    },
    clear(key) {
      failedAt.delete(key);
    },
    get size() {
      return failedAt.size;
    },
    inFlight,
  };
}

/**
 * Read `key` through the memo.
 *
 * `handleFailure` decides what a failure means: return the fallback (the
 * failure is then recorded) or throw (it propagates and nothing is recorded).
 * It runs once per upstream call, never once per caller: a caller that joins a
 * running read gets that read's value, its own `fallback` when the read
 * failed, or the same throw when the read's handler threw (a 402 is a 402 for
 * every reader of the path).
 */
export async function readWithFailureMemo<T>(
  memo: FailureMemo,
  key: string,
  read: () => Promise<T>,
  fallback: T,
  handleFailure: (err: unknown) => T,
): Promise<T> {
  // Already reported by the read that failed inside this window, so the
  // fallback is returned without a second capture for the same outage.
  if (memo.hasRecentFailure(key)) return fallback;

  // Cast: a key is one request path, and every read of one path resolves the
  // same payload type, so the running read's outcome is a SharedOutcome<T>.
  const running = memo.inFlight.get(key) as Promise<SharedOutcome<T>> | undefined;
  if (running) {
    const outcome = await running;
    return outcome.ok ? outcome.value : fallback;
  }

  let handled: T = fallback;
  const shared = (async (): Promise<SharedOutcome<T>> => {
    try {
      return { ok: true, value: await read() };
    } catch (err) {
      handled = handleFailure(err);
      memo.recordFailure(key);
      return { ok: false };
    }
  })();
  memo.inFlight.set(key, shared);
  try {
    const outcome = await shared;
    if (!outcome.ok) return handled;
    memo.clear(key);
    return outcome.value;
  } finally {
    if (memo.inFlight.get(key) === shared) memo.inFlight.delete(key);
  }
}
