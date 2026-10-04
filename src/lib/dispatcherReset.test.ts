import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  THAW_RESET_THRESHOLD_MS,
  noteRequestAndMaybeResetDispatcher,
  getDispatcherResetInfo,
  __resetDispatcherStateForTests,
} from './dispatcherReset.ts';

const SYMBOL = Symbol.for('undici.globalDispatcher.1');

class FakeDispatcher {
  destroyed = false;
  destroy(): void {
    this.destroyed = true;
  }
}

function slot(): Record<symbol, unknown> {
  return globalThis as unknown as Record<symbol, unknown>;
}

const realDispatcher = slot()[SYMBOL];

beforeEach(() => {
  __resetDispatcherStateForTests();
  slot()[SYMBOL] = new FakeDispatcher();
});

afterEach(() => {
  __resetDispatcherStateForTests();
  slot()[SYMBOL] = realDispatcher;
});

function clock(start: number) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

test('the first invocation this process has seen never resets (nothing pooled yet)', () => {
  const c = clock(1_000_000);
  const reset = noteRequestAndMaybeResetDispatcher(c.now);
  assert.equal(reset, false);
  assert.equal((slot()[SYMBOL] as FakeDispatcher).destroyed, false);
});

test('a gap under the threshold does not reset — zero cost on a warm burst', () => {
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  c.advance(THAW_RESET_THRESHOLD_MS - 1);
  const reset = noteRequestAndMaybeResetDispatcher(c.now);
  assert.equal(reset, false);
  assert.equal((slot()[SYMBOL] as FakeDispatcher).destroyed, false);
});

test('a gap at or over the threshold destroys the stale dispatcher and installs a fresh one of the same class', () => {
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  const stale = slot()[SYMBOL] as FakeDispatcher;
  c.advance(THAW_RESET_THRESHOLD_MS);
  const reset = noteRequestAndMaybeResetDispatcher(c.now);

  assert.equal(reset, true);
  assert.equal(stale.destroyed, true, 'the old instance must be destroyed, not merely abandoned');
  const fresh = slot()[SYMBOL];
  assert.notEqual(fresh, stale, 'a new instance must replace it in the same turn');
  assert.ok(fresh instanceof FakeDispatcher, 'the replacement is the same class, built reflectively');
  assert.equal((fresh as FakeDispatcher).destroyed, false);
});

test('getDispatcherResetInfo is empty until a reset has actually happened', () => {
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  assert.deepEqual(getDispatcherResetInfo(c.now), {});
});

test('getDispatcherResetInfo reports elapsed time and a running count after a reset', () => {
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  c.advance(THAW_RESET_THRESHOLD_MS);
  noteRequestAndMaybeResetDispatcher(c.now);
  c.advance(42);

  const info = getDispatcherResetInfo(c.now);
  assert.equal(info.msSinceDispatcherReset, 42);
  assert.equal(info.dispatcherResetCount, 1);
});

test('a reset that throws (no destroy method, or a hostile dispatcher) is swallowed, never thrown at the caller', () => {
  slot()[SYMBOL] = { destroy: () => { throw new Error('boom'); } };
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  c.advance(THAW_RESET_THRESHOLD_MS);
  assert.doesNotThrow(() => noteRequestAndMaybeResetDispatcher(c.now));
});

test('no dispatcher created yet (nothing has ever fetched in this process) is a no-op, not a throw', () => {
  // Assignment, not `delete`: Node's real dispatcher slot is non-configurable
  // once any real fetch in this process has set it, so a test must not rely
  // on deleting the key. Setting it to `undefined` exercises the exact same
  // `!current` guard as a key that was never set at all.
  slot()[SYMBOL] = undefined;
  const c = clock(1_000_000);
  noteRequestAndMaybeResetDispatcher(c.now);
  c.advance(THAW_RESET_THRESHOLD_MS);
  const reset = noteRequestAndMaybeResetDispatcher(c.now);
  assert.equal(reset, false);
});
