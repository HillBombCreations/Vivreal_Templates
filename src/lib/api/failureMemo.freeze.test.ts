import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFailureMemo, readWithFailureMemo } from './failureMemo.ts';
import { createAwakeStopwatchFactory } from '../awakeTimeout.ts';

/**
 * The join guard, the frozen-time straddle rule and the floor hand-out
 * (vivreal-hq docs/bugs/site-first-read-fallback/plan.md, T3, T9, T10).
 *
 * One hand-cranked clock drives BOTH the memo's window and the stopwatch every
 * read carries, so a freeze is simulated exactly: `freeze(ms)` moves the clock
 * with no tick (the process was not running), `awake(ms)` moves it in 100 ms
 * ticks (it was).
 */

const PATH = '/tenant/siteDetails?siteId=abc';
const FALLBACK = { fallback: true } as const;
type Value = { fresh?: number; floor?: boolean; fallback?: boolean };

function world() {
  let t = 2_000_000;
  let tick: (() => void) | null = null;
  const startStopwatch = createAwakeStopwatchFactory({
    now: () => t,
    setInterval: (fn: () => void) => {
      tick = fn;
      return 1;
    },
    clearInterval: () => {
      tick = null;
    },
  });
  const memo = createFailureMemo({ now: () => t, startStopwatch });
  return {
    memo,
    awake(ms: number) {
      for (let spent = 0; spent < ms; spent += 100) {
        t += 100;
        tick?.();
      }
    },
    freeze(ms: number) {
      t += ms;
    },
  };
}

/** A read the test settles by hand, counting how often it was started. */
function deferredRead() {
  let calls = 0;
  let settle: { resolve: (v: Value) => void; reject: (e: unknown) => void } | null = null;
  return {
    get calls() {
      return calls;
    },
    read: () =>
      new Promise<Value>((resolve, reject) => {
        calls += 1;
        settle = { resolve, reject };
      }),
    resolve(v: Value) {
      settle?.resolve(v);
    },
    reject(e: unknown) {
      settle?.reject(e);
    },
  };
}

function econnreset(): TypeError {
  return new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });
}

const toFallback = () => FALLBACK as Value;
const flush = () => new Promise((r) => setImmediate(r));

/* ------------------------------ T9: the join ------------------------------ */

test('T9 REFUSE: a reader does not inherit a running read that slept through a 120 s freeze', async () => {
  const w = world();
  const a = deferredRead();
  const pa = readWithFailureMemo<Value>(w.memo, PATH, a.read, FALLBACK, toFallback);
  await flush();
  w.freeze(120_000);
  const b = deferredRead();
  const pb = readWithFailureMemo<Value>(w.memo, PATH, b.read, FALLBACK, toFallback);
  await flush();
  b.resolve({ fresh: 1 });
  a.reject(econnreset());
  assert.deepEqual(await pb, { fresh: 1 }, 'B gets its own fresh read, not the frozen read\'s failure');
  assert.equal(b.calls, 1, "B's read ran once");
  assert.equal(await pa, FALLBACK, 'A itself still answers its fallback');
});

test('T9 ALLOW: a reader 50 ms behind an awake read joins it, one upstream call', async () => {
  const w = world();
  const a = deferredRead();
  const pa = readWithFailureMemo<Value>(w.memo, PATH, a.read, FALLBACK, toFallback);
  await flush();
  w.awake(50);
  const b = deferredRead();
  const pb = readWithFailureMemo<Value>(w.memo, PATH, b.read, FALLBACK, toFallback);
  a.resolve({ fresh: 7 });
  assert.deepEqual(await pa, { fresh: 7 });
  assert.deepEqual(await pb, { fresh: 7 });
  assert.equal(a.calls + b.calls, 1, 'one upstream call in total');
});

test('T9 ALLOW: a read hung 15 s while AWAKE is still shared (a real outage costs one call)', async () => {
  const w = world();
  const a = deferredRead();
  const pa = readWithFailureMemo<Value>(w.memo, PATH, a.read, FALLBACK, toFallback);
  await flush();
  w.awake(15_000);
  const b = deferredRead();
  const pb = readWithFailureMemo<Value>(w.memo, PATH, b.read, FALLBACK, toFallback);
  a.reject(econnreset());
  assert.equal(await pa, FALLBACK);
  assert.equal(await pb, FALLBACK);
  assert.equal(b.calls, 0, 'B joined A');
  assert.equal(a.calls, 1);
});

/* --------------------------- T10: the straddle ---------------------------- */

/**
 * The streak window is 5 s between failures, so the first failure below is the
 * slow one and the second is quick; what is under test is whether the SLOW
 * failure counts toward the streak.
 */
async function slowFailureThenQuickFailure(w: ReturnType<typeof world>, slow: (ms: number) => void, ms: number) {
  const first = deferredRead();
  const p1 = readWithFailureMemo<Value>(w.memo, PATH, first.read, FALLBACK, toFallback);
  await flush();
  slow(ms);
  first.reject(econnreset());
  await p1;
  await readWithFailureMemo<Value>(w.memo, PATH, async () => { throw econnreset(); }, FALLBACK, toFallback);
  let thirdCalls = 0;
  const third = await readWithFailureMemo<Value>(
    w.memo,
    PATH,
    async () => {
      thirdCalls += 1;
      return { fresh: 3 };
    },
    FALLBACK,
    toFallback,
  );
  return { thirdCalls, third };
}

test('T10 REFUSE: a failure that took 30 s of AWAKE time counts, so the pause arms and the third read makes no call', async () => {
  const w = world();
  const { thirdCalls, third } = await slowFailureThenQuickFailure(w, (ms) => w.awake(ms), 30_000);
  assert.equal(thirdCalls, 0, 'a real hang is an outage signal: paused');
  assert.equal(third, FALLBACK);
});

test('T10 ALLOW: a failure that was FROZEN 60 s does not count, so the third read goes upstream', async () => {
  const w = world();
  const { thirdCalls, third } = await slowFailureThenQuickFailure(w, (ms) => w.freeze(ms), 60_000);
  assert.equal(thirdCalls, 1, 'a freeze-killed read says nothing about the upstream');
  assert.deepEqual(third, { fresh: 3 });
});

test('T10 CONTROL: two quick failures arm the pause, as today', async () => {
  const w = world();
  const { thirdCalls } = await slowFailureThenQuickFailure(w, (ms) => w.awake(ms), 0);
  assert.equal(thirdCalls, 0);
});

/* ----------------------- T3: the memo and join floor ---------------------- */

const FLOOR: Value = { floor: true };

test('T3 REFUSE: once the pause is armed, the paused read answers the floor, not the fallback', async () => {
  const w = world();
  const down = async () => { throw econnreset(); };
  const floorReasons: string[] = [];
  const floorFor = (reason: string) => {
    floorReasons.push(reason);
    return { ...FLOOR };
  };
  await readWithFailureMemo<Value>(w.memo, PATH, down, FALLBACK, toFallback, floorFor);
  await readWithFailureMemo<Value>(w.memo, PATH, down, FALLBACK, toFallback, floorFor);
  let calls = 0;
  const third = await readWithFailureMemo<Value>(
    w.memo,
    PATH,
    async () => {
      calls += 1;
      return { fresh: 1 };
    },
    FALLBACK,
    toFallback,
    floorFor,
  );
  assert.equal(calls, 0, 'still paused');
  assert.deepEqual(third, FLOOR);
  assert.notEqual(third, FALLBACK);
  assert.deepEqual(floorReasons, ['memo']);
});

test('T3 REFUSE: a reader that joined a failed read answers the floor, not the fallback', async () => {
  const w = world();
  const a = deferredRead();
  const floorFor = () => ({ ...FLOOR });
  const pa = readWithFailureMemo<Value>(w.memo, PATH, a.read, FALLBACK, toFallback, floorFor);
  await flush();
  const pb = readWithFailureMemo<Value>(w.memo, PATH, deferredRead().read, FALLBACK, toFallback, floorFor);
  a.reject(econnreset());
  assert.equal(await pa, FALLBACK, "the owner of the read gets what its own handler returned");
  assert.deepEqual(await pb, FLOOR);
});

test('T3 CONTROL: with no floor for the key, the paused read answers the fallback as before', async () => {
  const w = world();
  const down = async () => { throw econnreset(); };
  const noFloor = () => undefined;
  await readWithFailureMemo<Value>(w.memo, PATH, down, FALLBACK, toFallback, noFloor);
  await readWithFailureMemo<Value>(w.memo, PATH, down, FALLBACK, toFallback, noFloor);
  assert.equal(await readWithFailureMemo<Value>(w.memo, PATH, down, FALLBACK, toFallback, noFloor), FALLBACK);
});
