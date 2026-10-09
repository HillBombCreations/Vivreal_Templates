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
}

export function createFailureMemo({
  ttlMs = FAILURE_MEMO_MS,
  maxKeys = FAILURE_MEMO_MAX_KEYS,
  now = Date.now,
}: { ttlMs?: number; maxKeys?: number; now?: () => number } = {}): FailureMemo {
  const failedAt = new Map<string, number>();

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
  };
}

/**
 * Read `key` through the memo.
 *
 * `handleFailure` decides what a failure means: return the fallback (the
 * failure is then recorded) or throw (it propagates and nothing is recorded).
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
  let value: T;
  try {
    value = await read();
  } catch (err) {
    const result = handleFailure(err);
    memo.recordFailure(key);
    return result;
  }
  memo.clear(key);
  return value;
}
