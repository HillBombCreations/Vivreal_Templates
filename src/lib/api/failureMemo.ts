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
 *
 * FROZEN TIME, NOT WALL CLOCK (site-first-read-fallback plan, section 9,
 * vivreal-hq docs/bugs/site-first-read-fallback). Amplify freezes the process
 * between requests, and a read that was in flight at the freeze dies on thaw
 * minutes later (164 of 164 exhausted chains, 10-16 to 10-23, straddled a
 * freeze). Two consequences, both classified by how long the read was FROZEN
 * (wall time minus awake time, `startAwakeStopwatch`), never by wall time:
 * - A failure that straddled a freeze (frozen `FREEZE_STRADDLE_MS` or more)
 *   says nothing about the upstream, so it does not count toward the D7
 *   streak and can never arm the pause. A failure that took 30 s of AWAKE
 *   time (CloudFront's origin read timeout, a connect timeout) is a real
 *   outage signal and counts exactly as before.
 * - A reader does not join a running read that has been frozen
 *   `FREEZE_STRADDLE_MS` or more; it starts its own. An awake but slow read is
 *   still shared, so a real outage still costs one upstream call.
 *
 * THE FLOOR. A caller may pass `floorFor`, which answers the build-time site
 * snapshot for this key (`./snapshot/floor.ts`) or `undefined` when there is
 * none. The memo short-circuit and a failed join hand that out instead of the
 * fallback, so a paused or shared failure renders the site as of its last
 * build rather than a placeholder. The caller's own failed read decides its
 * floor inside `handleFailure`. The memo never stores a floor answer.
 */

import { startAwakeStopwatch, type AwakeStopwatch } from '../awakeTimeout.ts';

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

/**
 * A read frozen this long or longer straddled a freeze: its failure does not
 * count toward the streak, and a later reader does not join it. 5 s is about
 * 16 ticks of the awake timer's 300 ms clamp, far from both a real freeze
 * (tens of seconds to minutes) and an awake hang (frozen about 0).
 */
export const FREEZE_STRADDLE_MS = 5_000;

/** A read in flight, with the stopwatch that says how long it has been frozen. */
export interface InFlightRead {
  readonly outcome: Promise<unknown>;
  readonly stopwatch: AwakeStopwatch;
}

export interface FailureMemo {
  hasRecentFailure(key: string): boolean;
  /** `straddled`: the failed read slept through a freeze, so it is not counted. */
  recordFailure(key: string, opts?: { straddled?: boolean }): void;
  clear(key: string): void;
  readonly size: number;
  /**
   * Reads running right now, by key. An entry lives only while its read is in
   * flight (removed when it settles), so this is bounded by concurrency, not
   * by the key space.
   */
  readonly inFlight: Map<string, InFlightRead>;
  /** Starts the stopwatch a new read carries. Injectable for tests. */
  startStopwatch(): AwakeStopwatch;
  /** True when the stopwatch has been frozen `FREEZE_STRADDLE_MS` or more. */
  isStraddled(stopwatch: AwakeStopwatch): boolean;
}

/** Why a read answered from the floor rather than from its own read. */
export type MemoFloorReason = 'memo' | 'join';

/** What a shared read settled to: its value, or "failed, use your fallback". */
type SharedOutcome<T> = { ok: true; value: T } | { ok: false };

export function createFailureMemo({
  ttlMs = FAILURE_MEMO_MS,
  maxKeys = FAILURE_MEMO_MAX_KEYS,
  now = Date.now,
  startStopwatch = startAwakeStopwatch,
  straddleMs = FREEZE_STRADDLE_MS,
}: {
  ttlMs?: number;
  maxKeys?: number;
  now?: () => number;
  startStopwatch?: () => AwakeStopwatch;
  straddleMs?: number;
} = {}): FailureMemo {
  // The latest failure of each key and how many came in a row, each within
  // `ttlMs` of the one before (D7: the pause needs a streak, not one blip).
  const failedAt = new Map<string, { at: number; streak: number }>();
  const inFlight = new Map<string, InFlightRead>();

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
    recordFailure(key, opts) {
      // A read that slept through a freeze failed because the process was
      // frozen, not because the upstream is down. Counting it would let one
      // freeze-killed background read pause foreground reads of a healthy API.
      if (opts?.straddled) return;
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
    startStopwatch,
    isStraddled(stopwatch) {
      return stopwatch.wallMs() - stopwatch.awakeMs() >= straddleMs;
    },
  };
}

/**
 * Read `key` through the memo.
 *
 * `handleFailure` decides what a failure means: return the fallback (or a
 * floor answer; the failure is then recorded) or throw (it propagates and
 * nothing is recorded). It runs once per upstream call, never once per caller:
 * a caller that joins a running read gets that read's value, the floor (or its
 * own `fallback`) when the read failed, or the same throw when the read's
 * handler threw (a 402 is a 402 for every reader of the path).
 *
 * `floorFor` answers the build-time snapshot for the memo short-circuit and a
 * failed join, or `undefined` when there is none (see the module docblock).
 */
export async function readWithFailureMemo<T>(
  memo: FailureMemo,
  key: string,
  read: () => Promise<T>,
  fallback: T,
  handleFailure: (err: unknown) => T,
  floorFor?: (reason: MemoFloorReason) => T | undefined,
): Promise<T> {
  const floorOrFallback = (reason: MemoFloorReason): T => {
    const floor = floorFor?.(reason);
    return floor === undefined ? fallback : floor;
  };

  // Failures of this key have REPEATED inside the window (D7: one blip never
  // pauses), and were already reported, so the answer is given without a
  // further upstream call or capture for the same outage.
  if (memo.hasRecentFailure(key)) return floorOrFallback('memo');

  // A running read that slept through a freeze is not inherited: it is about
  // to die on a dead socket, and joining it hands this reader that death.
  const running = memo.inFlight.get(key);
  if (running && !memo.isStraddled(running.stopwatch)) {
    // Cast: a key is one request path, and every read of one path resolves the
    // same payload type, so the running read's outcome is a SharedOutcome<T>.
    const outcome = (await running.outcome) as SharedOutcome<T>;
    return outcome.ok ? outcome.value : floorOrFallback('join');
  }

  let handled: T = fallback;
  const stopwatch = memo.startStopwatch();
  const shared = (async (): Promise<SharedOutcome<T>> => {
    try {
      return { ok: true, value: await read() };
    } catch (err) {
      // Stopped BEFORE the handler runs, so the straddle verdict is the read's
      // own frozen time, not the read plus whatever the handler costs.
      stopwatch.stop();
      handled = handleFailure(err);
      memo.recordFailure(key, { straddled: memo.isStraddled(stopwatch) });
      return { ok: false };
    } finally {
      stopwatch.stop();
    }
  })();
  const entry: InFlightRead = { outcome: shared, stopwatch };
  memo.inFlight.set(key, entry);
  try {
    const outcome = await shared;
    if (!outcome.ok) return handled;
    memo.clear(key);
    return outcome.value;
  } finally {
    if (memo.inFlight.get(key) === entry) memo.inFlight.delete(key);
  }
}
