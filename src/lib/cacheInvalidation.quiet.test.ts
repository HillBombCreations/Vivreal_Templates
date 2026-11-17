/**
 * T-268 (F268, release B): the first shell read after a quiet spell gets the
 * cold limits, even on an instance that holds `L`.
 *
 * The measured case (vivreal-hq admin-triage-2026-11-13.md B1): vivreal.io's
 * home, hours after its last request, read `siteDetails`; the read was cut at
 * its 1,515 ms limit while VR_Client_API answered it in 386 ms, so the time
 * went before the Lambda. Here the read answers at 2,000 ms of awake time,
 * which the warm 1,500 ms deadline cuts and the cold 5,500 ms one does not.
 *
 * The ALLOW pair: a busy instance (last live answer 10 s ago) keeps the warm
 * limits, so a slow read there is still cut at 1,500 ms and answered from
 * `L`, as before. Without it, "every read gets 5.5 s" would pass the REFUSE.
 *
 * Time: `now` is wall clock (it jumps across a quiet spell, as a frozen
 * Amplify instance's does); timers fire only when the test advances awake
 * time. A namespace import, so at a base without the change each row fails on
 * its own assertion rather than the file failing to load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as invalidation from './cacheInvalidation.ts';

const SITE = '6a8d1146a4e1b46a9083e668';
const PATH = `/tenant/siteDetails?siteId=${SITE}`;
const T0 = Date.UTC(2026, 10, 13, 10, 0, 0);
const SLOW_READ_MS = 2_000;

type Body = { pages: string[]; updatedAt: string };
type Fence = {
  resolve(
    reader: 'full' | 'known' | 'plain',
    reads: { cached(path: string, signal: AbortSignal): Promise<Body>; fresh(signal: AbortSignal): Promise<{ value: Body; refused: boolean }>; floor(): Body },
    path: string,
    isLive: (value: Body) => boolean,
  ): Promise<{ value: Body; stale: boolean }>;
};

function fakeClock() {
  const clock = {
    now: T0,
    timers: [] as Array<{ at: number; fn: () => void; live: boolean }>,
    startTimeout(ms: number, fn: () => void) {
      const timer = { at: clock.now + ms, fn, live: true };
      clock.timers.push(timer);
      return { cancel: () => { timer.live = false; } };
    },
    startStopwatch() {
      const start = clock.now;
      return { awakeMs: () => clock.now - start, stop: () => undefined };
    },
    nextDue(): number | undefined {
      const live = clock.timers.filter((t) => t.live).map((t) => t.at);
      return live.length ? Math.min(...live) : undefined;
    },
  };
  return clock;
}

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Run `promise` on the fake clock, firing each due timer until it settles. */
async function drive<T>(clock: ReturnType<typeof fakeClock>, promise: Promise<T>): Promise<T> {
  let done = false;
  let value: T | undefined;
  promise.then((v) => { done = true; value = v; });
  await flush();
  while (!done) {
    const next = clock.timers.filter((t) => t.live).sort((a, b) => a.at - b.at)[0];
    if (!next) throw new Error('the resolution hangs');
    clock.now = next.at;
    next.live = false;
    next.fn();
    await flush();
  }
  return value as T; // settled above
}

const SAVED = '2026-11-13T09:00:00.000Z';
const L_BODY: Body = { pages: ['about'], updatedAt: SAVED };
const FRESH_BODY: Body = { pages: ['about', 'pricing'], updatedAt: SAVED };
const FLOOR_BODY: Body = { pages: ['floor'], updatedAt: SAVED };

/**
 * One instance: a first, fast resolution (a FULL reader) gives it `K` and `L`;
 * then `gapMs` of wall clock pass; then the home page (KNOWN) reads once more,
 * and its cached read answers only after `SLOW_READ_MS` of awake time.
 */
async function secondReadAfter(gapMs: number) {
  const clock = fakeClock();
  const createSiteVersionFence = (invalidation as unknown as Record<string, unknown>).createSiteVersionFence as (deps: Record<string, unknown>) => Fence; // checked by the call below
  const fence = createSiteVersionFence({
    siteId: SITE,
    probe: async () => ({ siteId: SITE, updatedAt: SAVED }),
    now: () => clock.now,
    startTimeout: (ms: number, fn: () => void) => clock.startTimeout(ms, fn),
    startStopwatch: () => clock.startStopwatch(),
  });
  const isLive = (value: Body) => value !== FLOOR_BODY;

  await drive(clock, fence.resolve('full', {
    cached: async () => L_BODY,
    fresh: async () => ({ value: L_BODY, refused: false }),
    floor: () => FLOOR_BODY,
  }, PATH, isLive));

  clock.now += gapMs;

  const aborted: boolean[] = [];
  const second = await drive(clock, fence.resolve('known', {
    cached: (_path, signal) => new Promise<Body>((resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted.push(true);
        reject(new DOMException('This operation was aborted', 'AbortError'));
      });
      clock.startTimeout(SLOW_READ_MS, () => {
        if (!signal.aborted) resolve(FRESH_BODY);
      });
    }),
    fresh: async () => ({ value: FRESH_BODY, refused: false }),
    floor: () => FLOOR_BODY,
  }, PATH, isLive));
  return { second, aborted };
}

test('[T-268 REFUSE] after five hours of quiet, a 2 s first read is NOT cut: the live answer is served', async () => {
  const { second, aborted } = await secondReadAfter(5 * 60 * 60 * 1000);
  assert.deepEqual(aborted, [], 'the first read after the quiet spell was aborted at the warm deadline');
  assert.equal(second.value, FRESH_BODY);
});

test('[T-268 ALLOW] a busy instance (10 s since its last answer) keeps the warm 1.5 s cut and answers from L', async () => {
  const { second, aborted } = await secondReadAfter(10_000);
  assert.ok(aborted.length >= 1, 'the warm deadline still cuts a slow read on a busy instance');
  assert.deepEqual(second.value, L_BODY);
});

test('[T-268 ALLOW] the quiet spell is five minutes, the shell data-cache window at the provisioned TTL', () => {
  const ns = invalidation as unknown as Record<string, unknown>; // named exports, checked here
  assert.equal(ns.QUIET_SPELL_MS, 300_000);
  assert.equal(ns.SHELL_READ_DEADLINE_MS, 1_500);
  assert.equal(ns.SHELL_READ_DEADLINE_COLD_MS, 5_500);
});
