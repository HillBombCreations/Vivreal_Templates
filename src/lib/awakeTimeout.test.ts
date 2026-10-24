import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAKE_MAX_CREDIT_MS, createAwakeStopwatchFactory, startAwakeTimeout } from './awakeTimeout.ts';

/**
 * A hand-cranked clock and interval, so a Lambda freeze can be simulated
 * exactly: `advance(ms)` moves the clock by `ms` and fires the interval ONCE,
 * which is what a thawed process sees after any gap, short or long.
 */
function harness() {
  let now = 1_000_000;
  let tick: (() => void) | null = null;
  let cleared = 0;
  return {
    options: {
      now: () => now,
      setInterval: (fn: () => void) => {
        tick = fn;
        return 1;
      },
      clearInterval: () => {
        cleared += 1;
        tick = null;
      },
    },
    advance(ms: number) {
      now += ms;
      tick?.();
    },
    get cleared() {
      return cleared;
    },
  };
}

test('expires once awake time reaches the budget', () => {
  const h = harness();
  let expired = 0;
  startAwakeTimeout(800, () => (expired += 1), h.options);
  for (let i = 0; i < 7; i += 1) h.advance(100);
  assert.equal(expired, 0, '700 ms awake is under budget');
  h.advance(100);
  assert.equal(expired, 1);
  assert.equal(h.cleared, 1, 'the interval is cleared on expiry');
});

test('a freeze does not use up the budget: a 60 s gap credits at most AWAKE_MAX_CREDIT_MS', () => {
  // The production failure: a background refresh armed an 800 ms abort, the
  // process froze for a minute, and the abort fired on thaw before the fetch
  // could resume. A wall-clock timer expires on this advance(60_000).
  const h = harness();
  let expired = 0;
  startAwakeTimeout(800, () => (expired += 1), h.options);
  h.advance(100);
  h.advance(60_000);
  assert.equal(expired, 0, 'a frozen minute must not expire an 800 ms budget');
  // 100 + 300 credited so far; the remaining 400 ms must be real awake time.
  const remaining = 800 - 100 - AWAKE_MAX_CREDIT_MS;
  for (let spent = 0; spent + 100 < remaining; spent += 100) h.advance(100);
  assert.equal(expired, 0);
  h.advance(100);
  assert.equal(expired, 1);
});

test('repeated freezes each credit only the ceiling', () => {
  const h = harness();
  let expired = 0;
  startAwakeTimeout(800, () => (expired += 1), h.options);
  h.advance(5_000);
  h.advance(5_000);
  assert.equal(expired, 0, 'two freezes credit 600 ms');
  h.advance(5_000);
  assert.equal(expired, 1, 'a third reaches 900 ms');
});

test('cancel stops the timer and is idempotent', () => {
  const h = harness();
  let expired = 0;
  const t = startAwakeTimeout(800, () => (expired += 1), h.options);
  h.advance(300);
  t.cancel();
  t.cancel();
  h.advance(10_000);
  assert.equal(expired, 0);
  assert.equal(h.cleared, 1);
});

test('the default timers are real timers and expire in real time', async () => {
  let expired = false;
  startAwakeTimeout(50, () => (expired = true), { tickMs: 10 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(expired, true);
});

/*
 * The awake stopwatch (site-first-read-fallback plan, Change 5). It is what
 * `failureMemo.ts` uses to tell a read that slept through a freeze from a read
 * that hung while the process was running, so both halves are pinned: a
 * freeze reads as FROZEN, an awake hang reads as AWAKE.
 */
function stopwatchHarness() {
  let now = 5_000_000;
  let tick: (() => void) | null = null;
  let scheduled = 0;
  let cleared = 0;
  return {
    start: createAwakeStopwatchFactory({
      now: () => now,
      setInterval: (fn: () => void) => {
        scheduled += 1;
        tick = fn;
        return scheduled;
      },
      clearInterval: () => {
        cleared += 1;
        tick = null;
      },
    }),
    /** The process was awake for `ms`, ticking every 100 ms. */
    awake(ms: number) {
      for (let spent = 0; spent < ms; spent += 100) {
        now += 100;
        tick?.();
      }
    },
    /** The process was frozen for `ms`: the clock moves, no tick runs until the thaw. */
    freeze(ms: number) {
      now += ms;
    },
    thawTick() {
      tick?.();
    },
    get scheduled() {
      return scheduled;
    },
    get cleared() {
      return cleared;
    },
  };
}

test('stopwatch: a 60 s freeze reads as frozen, not awake', () => {
  const h = stopwatchHarness();
  const watch = h.start();
  h.awake(200);
  h.freeze(60_000);
  h.thawTick();
  const frozen = watch.wallMs() - watch.awakeMs();
  assert.equal(watch.wallMs(), 60_200);
  assert.ok(frozen >= 59_000, `frozen ${frozen} ms`);
});

test('stopwatch: a 30 s hang while awake reads as awake, not frozen', () => {
  const h = stopwatchHarness();
  const watch = h.start();
  h.awake(30_000);
  assert.equal(watch.wallMs(), 30_000);
  assert.equal(watch.wallMs() - watch.awakeMs(), 0);
});

test('stopwatch: between ticks the readings include the time since the last tick, clamped', () => {
  const h = stopwatchHarness();
  const watch = h.start();
  // No tick yet: 50 ms of wall, all of it credited as awake.
  h.freeze(50);
  assert.equal(watch.awakeMs(), 50);
  // A freeze still in progress (no tick has run) credits only the clamp.
  h.freeze(120_000);
  assert.equal(watch.awakeMs(), AWAKE_MAX_CREDIT_MS);
});

test('stopwatch: readings stop at stop(), and one shared interval serves every running stopwatch', () => {
  const h = stopwatchHarness();
  const a = h.start();
  const b = h.start();
  assert.equal(h.scheduled, 1, 'two running stopwatches share one interval');
  h.awake(1_000);
  a.stop();
  assert.equal(h.cleared, 0, 'the interval stays while b runs');
  h.awake(1_000);
  assert.equal(a.wallMs(), 1_000);
  assert.equal(a.awakeMs(), 1_000);
  assert.equal(b.wallMs(), 2_000);
  b.stop();
  b.stop();
  assert.equal(h.cleared, 1, 'cleared once, when the last stopwatch stops');
  h.start();
  assert.equal(h.scheduled, 2, 'a later stopwatch schedules a fresh interval');
});
