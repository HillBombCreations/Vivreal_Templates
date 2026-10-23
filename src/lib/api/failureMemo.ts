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
 * - REPEATED failures only (owner decision D7, 2026-10-23). A single one-off
 *   failed read does NOT start the pause: the next read of that key goes
 *   upstream as normal. Only `FAILURES_BEFORE_PAUSE` failures of one key, each
 *   within `FAILURE_MEMO_MS` of the one before, start it, and from then on,
 *   for `FAILURE_MEMO_MS` after the latest failure, a read of the same key
 *   answers the caller's fallback without going upstream. Before D7 one blip
 *   (a single slow or dropped connection) paused every read of that path for
 *   five seconds, which served visitors a fallback for an API that was fine.
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

/** How long a failed read is answered from the memo, once failures repeat. */
export const FAILURE_MEMO_MS = 5_000;

/**
 * D7: how many failures of one key, each within `FAILURE_MEMO_MS` of the
 * previous one, start the pause. One is a one-off and never pauses.
 */
export const FAILURES_BEFORE_PAUSE = 2;

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
  // The latest failure of each key and how many came in a row, each within
  // `ttlMs` of the one before (D7: the pause needs a streak, not one blip).
  const failedAt = new Map<string, { at: number; streak: number }>();
  const inFlight = new Map<string, Promise<unknown>>();

  const sweepExpired = () => {
    const t = now();
    for (const [key, entry] of failedAt) {
      if (t - entry.at >= ttlMs) failedAt.delete(key);
    }
  };

  return {
    hasRecentFailure(key) {
      const entry = failedAt.get(key);
      if (entry === undefined) return false;
      if (now() - entry.at >= ttlMs) {
        failedAt.delete(key);
        return false;
      }
      return entry.streak >= FAILURES_BEFORE_PAUSE;
    },
    recordFailure(key) {
      const previous = failedAt.get(key);
      const t = now();
      const streak = previous && t - previous.at < ttlMs ? previous.streak + 1 : 1;
      failedAt.delete(key);
      if (failedAt.size >= maxKeys) sweepExpired();
      // Still full of live entries: drop the oldest (Map keeps insertion order).
      if (failedAt.size >= maxKeys) {
        const oldest = failedAt.keys().next().value;
        if (oldest !== undefined) failedAt.delete(oldest);
      }
      failedAt.set(key, { at: t, streak });
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
  // Failures of this key have REPEATED inside the window (D7: one blip never
  // pauses), and were already reported, so the fallback is returned without a
  // further upstream call or capture for the same outage.
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
