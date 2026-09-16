/**
 * A timeout that counts only the time this process was AWAKE.
 *
 * WHY A PLAIN `setTimeout` IS WRONG HERE (measured on the live fleet, 2026-09-16)
 * ----------------------------------------------------------------------------
 * Amplify compute freezes the process as soon as a response is sent and thaws
 * it for the next request. Wall-clock timers keep "running" through the
 * freeze, so a timer armed by work that outlives its request (the edge site
 * map's background refresh) is already overdue when the process thaws, and it
 * fires before the work it guards has had any chance to resume.
 *
 * That is exactly what `edgeSiteMap`'s 800 ms abort did. Across Dougs Kitchen,
 * The Comedy Collective and Waves of Grain, 33 of 40
 * `[edgeSiteMap] fetch failed, failing open: AbortError` lines were logged
 * 1 to 194 ms after an invocation STARTED. None of those fetches had been
 * given 800 ms of running time; the timer simply fired on thaw. So on a quiet
 * site the background refresh of the redirect map and the frozen-account
 * verdict almost never completed.
 *
 * HOW
 * ---
 * A short interval accumulates elapsed time, but credits each tick with at
 * most `maxCreditMs`. A freeze arrives as one enormous gap between ticks and
 * is clamped to that ceiling, while ordinary awake time accrues in full. The
 * budget expires once the accumulated awake time reaches it.
 *
 * The clamp also undercounts a tick delayed by a long synchronous render, so
 * under heavy load the timeout runs somewhat long. That is the safe direction
 * for every caller here: they fail open, and a late abort costs a slower
 * failure, never a wrong answer.
 *
 * Edge-safe: timers and `Date.now` only. The clock and interval functions are
 * injectable so `awakeTimeout.test.ts` can simulate a freeze exactly.
 */

export interface AwakeTimeout {
  /** Stop the timer. Safe to call more than once, and after expiry. */
  cancel(): void;
}

export interface AwakeTimeoutOptions {
  /** Interval between awake-time samples. */
  readonly tickMs?: number;
  /** Most awake time one tick may credit. A freeze longer than this counts as this. */
  readonly maxCreditMs?: number;
  readonly now?: () => number;
  readonly setInterval?: (fn: () => void, ms: number) => unknown;
  readonly clearInterval?: (id: unknown) => void;
}

export const AWAKE_TICK_MS = 100;
export const AWAKE_MAX_CREDIT_MS = 300;

export function startAwakeTimeout(
  budgetMs: number,
  onExpire: () => void,
  options: AwakeTimeoutOptions = {},
): AwakeTimeout {
  const tickMs = options.tickMs ?? AWAKE_TICK_MS;
  const maxCreditMs = options.maxCreditMs ?? AWAKE_MAX_CREDIT_MS;
  const now = options.now ?? Date.now;
  const schedule = options.setInterval ?? ((fn: () => void, ms: number) => setInterval(fn, ms));
  const unschedule =
    options.clearInterval ?? ((id: unknown) => clearInterval(id as ReturnType<typeof setInterval>));

  let awakeMs = 0;
  let last = now();
  let done = false;

  const id = schedule(() => {
    if (done) return;
    const at = now();
    const gap = at - last;
    last = at;
    awakeMs += Math.min(Math.max(gap, 0), maxCreditMs);
    if (awakeMs >= budgetMs) {
      done = true;
      unschedule(id);
      onExpire();
    }
  }, tickMs);

  return {
    cancel() {
      if (done) return;
      done = true;
      unschedule(id);
    },
  };
}
