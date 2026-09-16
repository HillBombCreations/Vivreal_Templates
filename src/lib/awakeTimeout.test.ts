import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AWAKE_MAX_CREDIT_MS, startAwakeTimeout } from './awakeTimeout.ts';

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
