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

/**
 * How long a piece of work has run, split into AWAKE time and WALL time.
 *
 * `wallMs() - awakeMs()` is the time the process spent FROZEN while the work
 * was in flight. That is what tells a read that slept through an Amplify freeze
 * (frozen for seconds or minutes, then dead on thaw) apart from a read that
 * genuinely hung while the process was running (CloudFront's 30 s origin read
 * timeout, undici's connect timeout): both take a long wall time, only the
 * first is frozen for it. `failureMemo.ts` classifies on this (plan section 9,
 * docs/bugs/site-first-read-fallback in vivreal-hq).
 *
 * Same tick mechanism as `startAwakeTimeout`: every tick credits at most
 * `maxCreditMs`, so a freeze arrives as one huge gap clamped to that ceiling.
 * Between ticks `awakeMs()` adds the time since the last tick under the same
 * clamp, so a read that settles before the first tick reads as fully awake.
 */
export interface AwakeStopwatch {
  awakeMs(): number;
  wallMs(): number;
  /** Stop counting. Safe to call more than once. The readings freeze at the stop. */
  stop(): void;
}

export type AwakeStopwatchOptions = AwakeTimeoutOptions;

/**
 * A factory of stopwatches that share ONE interval while any of them runs, so
 * a burst of concurrent reads costs one ticker, not one per read. The interval
 * is cleared when the last running stopwatch stops, and it is `unref`ed where
 * the runtime supports it, so a stopwatch never keeps a process (a build
 * worker, a test) alive on its own.
 */
export function createAwakeStopwatchFactory(options: AwakeStopwatchOptions = {}): () => AwakeStopwatch {
  const tickMs = options.tickMs ?? AWAKE_TICK_MS;
  const maxCreditMs = options.maxCreditMs ?? AWAKE_MAX_CREDIT_MS;
  const now = options.now ?? Date.now;
  const schedule =
    options.setInterval ??
    ((fn: () => void, ms: number) => {
      const handle = setInterval(fn, ms);
      // Cast: Node's Timeout has `unref`, a browser or edge timer id does not.
      (handle as { unref?: () => void }).unref?.();
      return handle;
    });
  const unschedule =
    options.clearInterval ?? ((id: unknown) => clearInterval(id as ReturnType<typeof setInterval>));

  interface Running {
    awake: number;
    last: number;
  }
  const running = new Set<Running>();
  let intervalId: unknown = null;

  const credit = (entry: Running, at: number) => {
    entry.awake += Math.min(Math.max(at - entry.last, 0), maxCreditMs);
    entry.last = at;
  };

  const tick = () => {
    const at = now();
    for (const entry of running) credit(entry, at);
  };

  return () => {
    const startedAt = now();
    const entry: Running = { awake: 0, last: startedAt };
    let stoppedAt: number | null = null;
    let stoppedAwake = 0;
    running.add(entry);
    if (intervalId === null) intervalId = schedule(tick, tickMs);

    const awakeNow = (at: number) => entry.awake + Math.min(Math.max(at - entry.last, 0), maxCreditMs);

    return {
      awakeMs() {
        return stoppedAt === null ? awakeNow(now()) : stoppedAwake;
      },
      wallMs() {
        return (stoppedAt ?? now()) - startedAt;
      },
      stop() {
        if (stoppedAt !== null) return;
        const at = now();
        stoppedAwake = awakeNow(at);
        stoppedAt = at;
        running.delete(entry);
        if (running.size === 0 && intervalId !== null) {
          unschedule(intervalId);
          intervalId = null;
        }
      },
    };
  };
}

/** The process-wide factory: one shared ticker for every stopwatch in this process. */
export const startAwakeStopwatch: () => AwakeStopwatch = createAwakeStopwatchFactory();
