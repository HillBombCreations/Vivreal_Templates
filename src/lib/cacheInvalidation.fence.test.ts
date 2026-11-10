import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as invalidation from './cacheInvalidation.ts';
import { siteDetailsPath } from './api/readPaths.ts';
import { readCachedWithFloor, type FloorSeamDeps } from './api/snapshot/seam.ts';
import { createFailureMemo } from './api/failureMemo.ts';
import { floorHarness, snapshotOf } from './api/snapshot/testSupport.ts';
import { isFloorValue, markFloorValue } from './api/snapshot/floorValue.ts';
import { DegradedUpstreamError, refuseNegativeClaimFromFloor } from './api/siteData/degraded.ts';

/**
 * F41 and RW-4: the site version fence as one read state machine, driven per
 * vivreal-hq docs/projects/release-plan-open-backlog/design-t2-fence-state.md
 * (revision 3). Rows are named by the design's cells (T1 to T24) and
 * invariants (I1 to I9); its mutation map names the row each plant turns red.
 *
 * Each server instance is a fence, its own data cache keyed by the exact read
 * path (how Next keys `clientFetchCached`), and the reads `readSiteDetails`
 * hands the fence. The fake Client keeps a 60 s edge copy of every URL, as
 * client.vivreal.io does, and answers each kind of read (V, F, Pl, the probe)
 * as the row sets it. Time is a fake awake clock: timers fire only when the
 * row advances it, so every budget is measured exactly. The real route is
 * `scripts/isr-build-check.mjs` (phase F41).
 *
 * A namespace import, so at a base without the machine each row fails on its
 * own assertion rather than the file failing to load.
 */

const SITE = '6a8d1146a4e1b46a9083e668';
const SHELL = siteDetailsPath(SITE);
const TTL_MS = 300_000;
const T0 = Date.UTC(2026, 10, 9, 15, 6, 0);
const iso = (ms: number) => new Date(ms).toISOString();

type Body = { pages: string[]; updatedAt: string | null };
type Answer = Body | null;
type Reader = 'full' | 'known' | 'plain';
type Resolution = { value: Answer; stale: boolean };
type Reads = {
  cached(path: string, signal: AbortSignal): Promise<Answer>;
  fresh(signal: AbortSignal): Promise<{ value: Answer; refused: boolean }>;
  floor(): Answer;
};
type Fence = {
  resolve(reader: Reader, reads: Reads, path: string, isLive: (value: Answer) => boolean): Promise<Resolution>;
  markProbeDue(): unknown;
};
type Line = { reader: string; probe: string; target: string; answeredBy: string; stale: boolean; ms: number };

function api() {
  const ns = invalidation as unknown as Record<string, unknown>; // named exports, each checked below
  for (const name of ['createSiteVersionFence', 'versionedPath', 'readSiteVersion', 'readerClassFor', 'siteVersionPath']) {
    assert.equal(typeof ns[name], 'function', `cacheInvalidation exports ${name}`);
  }
  return {
    createSiteVersionFence: ns.createSiteVersionFence as (deps: Record<string, unknown>) => Fence,
    versionedPath: ns.versionedPath as (path: string, version: string | null) => string,
    readerClassFor: ns.readerClassFor as (u: unknown, w: unknown) => string,
    siteVersionPath: ns.siteVersionPath as (id: string) => string,
  };
}

/** A fake awake clock: timers fire only when a row advances it. */
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
      let stoppedAt: number | null = null;
      return { awakeMs: () => (stoppedAt ?? clock.now) - start, stop: () => { stoppedAt ??= clock.now; } };
    },
    /** Move time forward, firing every timer due on the way, in order. */
    advance(ms: number) {
      const until = clock.now + ms;
      for (;;) {
        const next = clock.timers.filter((t) => t.live && t.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        clock.now = next.at;
        next.live = false;
        next.fn();
      }
      clock.now = until;
    },
    nextDue(): number | undefined {
      const live = clock.timers.filter((t) => t.live).map((t) => t.at);
      return live.length ? Math.min(...live) : undefined;
    },
  };
  return clock;
}
type Clock = ReturnType<typeof fakeClock>;

const flush = async () => {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** Run a promise on the fake clock, advancing to each due timer until it settles. */
async function drive<T>(clock: Clock, promise: Promise<T>, limitMs = 120_000): Promise<{ value: T; ms: number }> {
  const start = clock.now;
  let done = false;
  let value: T | undefined;
  let error: unknown;
  promise.then((v) => { done = true; value = v; }, (e) => { done = true; error = e; });
  await flush();
  while (!done) {
    const due = clock.nextDue();
    if (due === undefined || due - start > limitMs) throw new Error(`no answer after ${clock.now - start} ms: the resolution hangs`);
    clock.advance(due - clock.now);
    await flush();
  }
  if (error !== undefined) throw error;
  return { value: value as T, ms: clock.now - start }; // settled above, so value is set
}

type Behaviour = 'ok' | 'fail' | 'refuse' | 'hang' | { delayMs: number };
const FAILED = Symbol('5xx or network');
const REFUSED = Symbol('4xx');

/** One fake VR_Client_API: the stored site, its version, a 60 s edge copy of each URL, and how each read kind answers. */
function fakeClient(clock: Clock) {
  const state = { pages: ['about', 'compare'], updatedAt: '2026-11-09T14:20:00.000Z' as string | null };
  const edge = new Map<string, { body: Body; at: number }>();
  const mode = { probe: 'up' as 'up' | 'slow' | 'fail', V: 'ok' as Behaviour, F: 'ok' as Behaviour, Pl: 'ok' as Behaviour };
  const probes: number[] = [];
  return {
    state,
    mode,
    probes,
    save(pages: string[]) {
      state.pages = pages;
      state.updatedAt = iso(clock.now);
    },
    /** A GET through the edge: a copy younger than 60 s is served as is. */
    body(path: string): Body {
      const hit = edge.get(path);
      if (hit && clock.now - hit.at < 60_000) return hit.body;
      const body = { pages: [...state.pages], updatedAt: state.updatedAt };
      edge.set(path, { body, at: clock.now });
      return body;
    },
    /** One upstream read of kind `kind`, by the row's behaviour; aborted by `signal`. */
    upstream(kind: 'V' | 'F' | 'Pl', path: string, signal: AbortSignal): Promise<Body | typeof FAILED | typeof REFUSED> {
      if (signal.aborted) return Promise.resolve(FAILED);
      const how = mode[kind];
      if (how === 'ok') return Promise.resolve(this.body(path));
      if (how === 'fail') return Promise.resolve(FAILED);
      if (how === 'refuse') return Promise.resolve(REFUSED);
      return new Promise((resolve) => {
        const onAbort = () => resolve(FAILED);
        signal.addEventListener('abort', onAbort);
        if (how !== 'hang') {
          clock.startTimeout(how.delayMs, () => {
            signal.removeEventListener('abort', onAbort);
            resolve(this.body(path));
          });
        }
      });
    },
    probe(signal: AbortSignal): Promise<unknown> {
      probes.push(clock.now);
      if (mode.probe === 'fail') return Promise.reject(new Error('VR_Client_API 503'));
      if (mode.probe === 'slow') return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
      return Promise.resolve({ siteId: SITE, updatedAt: state.updatedAt });
    },
  };
}
type Client = ReturnType<typeof fakeClient>;

const BUILD_FLOOR: Body = markFloorValue({ pages: ['from-the-build'], updatedAt: null });
const isLive = (value: Answer) => value !== null && !isFloorValue(value);

/**
 * One server instance: its fence (on `deps`), its own data cache, the reads
 * `readSiteDetails` makes, and a failure memo on the fresh key (two failures
 * within 5 s pause it, as `failureMemo.ts` does).
 */
function instance(client: Client, clock: Clock, opts: { probe?: (signal: AbortSignal) => Promise<unknown>; floor?: boolean; clone?: <V>(v: V) => V } = {}) {
  const { createSiteVersionFence, versionedPath } = api();
  const cache = new Map<string, { body: Body; at: number }>();
  const asked: string[] = [];
  const fresh: string[] = [];
  const lines: Line[] = [];
  const freshFailures: number[] = [];
  const floorAnswer = (): Answer => (opts.floor ? BUILD_FLOOR : null);
  const fence = createSiteVersionFence({
    siteId: SITE,
    probe: opts.probe ?? ((signal: AbortSignal) => client.probe(signal)),
    now: () => clock.now,
    startTimeout: (ms: number, fn: () => void) => clock.startTimeout(ms, fn),
    startStopwatch: () => clock.startStopwatch(),
    onDegraded: (line: Line) => lines.push(line),
    ...(opts.clone ? { clone: opts.clone } : {}),
  });
  const reads: Reads = {
    async cached(path, signal) {
      asked.push(path);
      const hit = cache.get(path);
      if (hit && clock.now - hit.at < TTL_MS) return hit.body;
      const out = await client.upstream(path.includes('&v=') ? 'V' : 'Pl', path, signal);
      if (out === FAILED || out === REFUSED) return floorAnswer();
      cache.set(path, { body: out, at: clock.now });
      return out;
    },
    async fresh(signal) {
      const path = versionedPath(SHELL, iso(clock.now));
      asked.push(path);
      fresh.push(path);
      const recent = freshFailures.filter((at) => clock.now - at < 5_000);
      if (recent.length >= 2) return { value: floorAnswer(), refused: false }; // the memo's short-circuit
      const out = await client.upstream('F', path, signal);
      if (out !== FAILED && out !== REFUSED) return { value: out, refused: false };
      freshFailures.push(clock.now);
      return { value: floorAnswer(), refused: out === REFUSED };
    },
    floor: floorAnswer,
  };
  return {
    fence,
    asked,
    fresh,
    lines,
    /** The webhook's purge, which only the instance that receives it gets. */
    purge: () => cache.clear(),
    async shell(reader: Reader = 'full'): Promise<Resolution & { ms: number }> {
      const { value, ms } = await drive(clock, fence.resolve(reader, reads, SHELL, isLive));
      return { ...value, ms };
    },
  };
}

const pagesOf = (r: Resolution) => r.value?.pages ?? [];
const has = (r: Resolution, page: string) => pagesOf(r).includes(page);
const vOf = (path: string | undefined) => new URL(path ?? '', 'http://x').searchParams.get('v');

/** An instance that has served the stored version `v1` once (K = L = v1). */
async function servedOnce(opts: Parameters<typeof instance>[2] = {}) {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock, opts);
  await a.shell(); // T1: K = L = v1
  const v1 = client.state.updatedAt;
  return { clock, client, a, v1 };
}

test('ALLOW (T1, T9, two instances): a save the webhook never told instance B about shows on B within one probe interval', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  const b = instance(client, clock);
  assert.deepEqual(pagesOf(await a.shell()), ['about', 'compare']);
  assert.deepEqual(pagesOf(await b.shell()), ['about', 'compare'], 'control: B holds the shell from before the save');
  clock.advance(2_000);
  client.save(['about', 'compare', 'new']);
  a.purge(); // the webhook reaches A only
  clock.advance(5_000);
  assert.ok(has(await b.shell(), 'new'), 'B lists the new page');
  assert.ok(has(await a.shell(), 'new'));
  assert.equal(vOf(b.asked.at(-1)), client.state.updatedAt, 'by the saved version');
});

test('REFUSE (RW-4 row 1, I1, T10): after a save, a slow or failed probe on an instance that served it still serves it, by the known version only', async () => {
  const { clock, client, a } = await servedOnce();
  clock.advance(22_000);
  client.save(['about', 'compare', 'qa-test-rewalk-t2-about']);
  clock.advance(30_000);
  assert.ok(has(await a.shell(), 'qa-test-rewalk-t2-about'), 'control: the instance served the saved site');
  const saved = client.state.updatedAt;
  await a.shell('known'); // home's plain-or-known read in between
  for (const probe of ['slow', 'fail', 'slow'] as const) {
    client.mode.probe = probe;
    clock.advance(60_000);
    const from = a.asked.length;
    const r = await a.shell();
    assert.ok(has(r, 'qa-test-rewalk-t2-about'), `probe ${probe}: still the saved site`);
    assert.equal(r.stale, false);
    assert.ok(a.asked.slice(from).every((p) => vOf(p) === saved), `probe ${probe}: every read carries the known version (no plain read, no fresh instant)`);
  }
  assert.equal(a.fresh.length, 0, 'a known version is read through the caches, never fresh on a failed probe');
});

test('REFUSE (RW-4 row 2, T2, I2, I7): a first read with a failed or slow probe serves the stored site, never an older plain copy', async () => {
  for (const probe of ['slow', 'fail'] as const) {
    // (a) this instance's own plain copy predates the save (home read it, KNOWN at S0).
    const clock = fakeClock();
    const client = fakeClient(clock);
    const a = instance(client, clock);
    assert.ok(!has(await a.shell('known'), 'new'), `${probe}: control, the plain copy is from before the save`);
    clock.advance(2_000);
    client.save(['about', 'compare', 'new']);
    clock.advance(1_000);
    client.mode.probe = probe;
    const first = await a.shell();
    assert.ok(has(first, 'new'), `${probe}: the first FULL read shows the stored site`);
    assert.equal(first.stale, false);
    assert.equal(a.fresh.length, 1, `${probe}: one fresh read`);
    clock.advance(1_000);
    assert.ok(has(await a.shell(), 'new'));
    assert.equal(a.asked.at(-1), api().versionedPath(SHELL, client.state.updatedAt), `${probe}: then by the version the fresh read carried`);
    assert.equal(a.fresh.length, 1, `${probe}: no second fresh read`);

    // (b) a cold instance, while client.vivreal.io holds a plain copy from before the save.
    const clock2 = fakeClock();
    const client2 = fakeClient(clock2);
    client2.body(SHELL);
    clock2.advance(2_000);
    client2.save(['about', 'compare', 'new']);
    clock2.advance(1_000);
    client2.mode.probe = probe;
    assert.ok(has(await instance(client2, clock2).shell(), 'new'), `${probe}: never the edge's plain copy from before the save`);
  }
});

test('REFUSE (T3b, I7, R3): S0, the fresh read times out, the plain copy answers stale and teaches nothing', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  await a.shell('known'); // the build-age plain copy, cached
  clock.advance(2_000);
  client.save(['about', 'compare', 'new']);
  client.mode.probe = 'slow';
  client.mode.F = 'hang';
  const r = await a.shell();
  assert.ok(!has(r, 'new'), 'control: the plain copy is from before the save');
  assert.equal(r.stale, true, 'stale: a page missing from it must answer 503, not 404');
  const site = markFloorValue({ pageConfigs: [] });
  assert.throws(() => refuseNegativeClaimFromFloor(r.stale ? site : {}), DegradedUpstreamError, 'the 404 verdict refuses');
  // Then: F runs again; K and L were not taught by the plain copy.
  client.mode.F = 'ok';
  clock.advance(6_000);
  const next = await a.shell();
  assert.ok(has(next, 'new'), 'the next render reads fresh and shows the stored site');
  assert.equal(a.fresh.length, 2, 'F ran again');
});

test('ALLOW (T3a, R1): S0, the fresh read refused with a 4xx (no #137): the plain copy is today\'s answer, unmarked, and teaches', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  client.mode.probe = 'fail';
  client.mode.F = 'refuse';
  const r = await a.shell();
  assert.deepEqual(pagesOf(r), ['about', 'compare']);
  assert.equal(r.stale, false, 'unmarked: a missing page answers 404, as today');
  clock.advance(6_000);
  await a.shell();
  assert.equal(vOf(a.asked.at(-1)), client.state.updatedAt, 'K was learned: the next render targets V');
});

test('REFUSE (R1): a fresh timeout, then a fast 5xx within 5 s, then a render whose fresh read short-circuits in the memo: the plain copy stays stale', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  await a.shell('known'); // the plain copy, cached
  client.mode.probe = 'slow';
  client.mode.F = 'hang';
  const first = await a.shell();
  assert.equal(first.stale, true, 'a timeout leaves the plain copy stale');
  client.mode.F = 'fail';
  const second = await a.shell();
  assert.equal(second.stale, true, 'a 5xx, fast, is not a refusal');
  client.mode.F = 'refuse'; // never reached: the memo answers first
  const third = await a.shell();
  assert.equal(a.fresh.length, 3);
  assert.equal(third.ms, 0, 'the memo short-circuit costs no wait');
  assert.equal(third.stale, true, 'decided by cause, not speed: a missing page answers 503, not 404');
});

test('ALLOW (T5, T6, I5): a site with no version reads plain, and reads fresh at most once', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  client.state.updatedAt = null;
  const a = instance(client, clock);
  for (let i = 0; i < 3; i += 1) {
    await a.shell();
    clock.advance(5_000);
  }
  assert.equal(a.fresh.length, 0, 'T5: the probe answered "no version", so never fresh');
  assert.deepEqual(a.asked, [SHELL, SHELL, SHELL]);
  // T6: the probe failed, the fresh read answered with no version.
  const clock2 = fakeClock();
  const client2 = fakeClient(clock2);
  client2.state.updatedAt = null;
  client2.mode.probe = 'fail';
  const b = instance(client2, clock2);
  for (let i = 0; i < 3; i += 1) {
    await b.shell();
    clock2.advance(5_000);
  }
  assert.equal(b.fresh.length, 1, 'T6: one fresh read, then plain');
});

test('REFUSE (T11, I1, I4): known and served, the versioned and plain reads fail after a purge: L answers, never the floor, and F is skipped', async () => {
  const { clock, client, a, v1 } = await servedOnce({ floor: true });
  a.purge();
  client.mode.V = 'fail';
  client.mode.Pl = 'fail';
  clock.advance(6_000);
  const r = await a.shell();
  assert.deepEqual(pagesOf(r), ['about', 'compare'], 'the newest shell served, not the build floor');
  assert.ok(!isFloorValue(r.value));
  assert.equal(r.stale, false, 'L holds K');
  assert.equal(a.fresh.length, 0, 'F skipped: L already holds K');
  // An older plain copy (an edge copy) loses to L.
  client.mode.Pl = 'ok';
  client.state.pages = ['older'];
  client.state.updatedAt = iso(Date.parse(v1 ?? '') - 60_000);
  clock.advance(6_000);
  assert.deepEqual(pagesOf(await a.shell()), ['about', 'compare'], 'newest of Pl and L');
});

test('ALLOW (review N4, re-pointed for B1): known v2 above L, V and F refused: reads [versioned, fresh, plain], the plain read answers', async () => {
  const { clock, client, a } = await servedOnce({ floor: true });
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  a.purge();
  client.mode.V = 'refuse';
  client.mode.F = 'refuse';
  clock.advance(5_000);
  const from = a.asked.length;
  const r = await a.shell();
  const kinds = a.asked.slice(from).map((p) => (vOf(p) === null ? 'plain' : a.fresh.includes(p) ? 'fresh' : 'versioned'));
  assert.deepEqual(kinds, ['versioned', 'fresh', 'plain']);
  assert.ok(has(r, 'new'), 'the plain read lists the saved page');
  assert.equal(r.stale, false);
});

test('REFUSE (T15b, G2, I4): K learned by the probe above L, then every v refused: the plain read still goes upstream (the budget is time, not a count)', async () => {
  const { clock, client, a } = await servedOnce({ floor: true });
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  a.purge();
  client.mode.V = 'refuse';
  client.mode.F = 'refuse';
  client.mode.Pl = { delayMs: 800 };
  clock.advance(5_000);
  const r = await a.shell();
  assert.ok(has(r, 'new'), `the stored words, from the plain read, got ${JSON.stringify(pagesOf(r))}`);
  assert.ok(r.ms <= 1_500 + 800, 'two refusals cost no wait');
});

test('REFUSE (T14, R2, I4, I7): a stale plain answer is served stale, a present page still renders, and it moves L but never K', async () => {
  const { clock, client, a } = await servedOnce({ floor: true });
  // v1.5: a save whose plain URL client.vivreal.io then holds for 60 s.
  clock.advance(1_000);
  client.save(['about', 'compare', 'v15']);
  client.body(SHELL);
  // v2: the stored site; the probe will teach K = v2 while L = v1.
  clock.advance(1_000);
  client.save(['about', 'compare', 'v15', 'menu']);
  const v2 = client.state.updatedAt;
  a.purge();
  client.mode.V = 'fail';
  client.mode.F = 'fail';
  clock.advance(6_000);
  const r = await a.shell();
  assert.ok(has(r, 'v15') && !has(r, 'menu'), `served the newer of Pl (v1.5) and L (v1), got ${JSON.stringify(pagesOf(r))}`);
  assert.equal(r.stale, true, 'older than K: stale');
  assert.ok(has(r, 'about'), 'G7: a page present in the stale shell is there to render (a positive claim stands)');
  const built = r.stale ? markFloorValue({ pageConfigs: pagesOf(r) }) : { pageConfigs: pagesOf(r) };
  assert.throws(() => refuseNegativeClaimFromFloor(built), DegradedUpstreamError, 'a page missing from it refuses (503), never 404');
  // Then every read fails: the answer is v1.5, never back to v1 (R2).
  a.purge();
  client.mode.Pl = 'fail';
  clock.advance(6_000);
  const all = await a.shell();
  assert.ok(has(all, 'v15'), `never back to v1, got ${JSON.stringify(pagesOf(all))}`);
  assert.equal(all.stale, true);
  // K stayed v2: with the probe slow, the recovered V reads v2.
  client.mode.probe = 'slow';
  client.mode.V = 'ok';
  clock.advance(6_000);
  const back = await a.shell();
  assert.equal(vOf(a.asked.at(-1)), v2, 'K never moved back');
  assert.ok(has(back, 'menu'));
});

test('REFUSE (I1): an older probe answer (a lagging read) never moves the version back', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  client.state.updatedAt = '2026-11-09T15:06:46.367Z';
  let answer: unknown = { siteId: SITE, updatedAt: '2026-11-09T15:06:46.367Z' };
  const a = instance(client, clock, { probe: async () => answer });
  await a.shell();
  answer = { siteId: SITE, updatedAt: '2026-11-09T15:06:40.000Z' };
  clock.advance(5_000);
  await a.shell();
  assert.equal(vOf(a.asked.at(-1)), '2026-11-09T15:06:46.367Z');
});

test('ALLOW (T17, T17\', I2, G5): a site webhook marks the probe due, never waits for it, and the next FULL render probes inside the interval', async () => {
  const { clock, client, a } = await servedOnce();
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  a.purge();
  const probesBefore = client.probes.length;
  assert.equal(a.fence.markProbeDue(), undefined, 'answers at once, nothing to await');
  clock.advance(1_000); // well inside the 5 s interval
  const r = await a.shell();
  assert.equal(client.probes.length, probesBefore + 1, 'the next FULL render probed first');
  assert.ok(has(r, 'new'));
  assert.equal(vOf(a.asked.at(-1)), client.state.updatedAt, 'and read the new version');
  // With a probe that never settles, the webhook still answers at once.
  client.mode.probe = 'slow';
  a.fence.markProbeDue();
  const pending = a.fence.resolve('full', { cached: async () => null, fresh: async () => ({ value: null, refused: false }), floor: () => null }, SHELL, isLive);
  await flush();
  assert.equal(a.fence.markProbeDue(), undefined, 'not a promise: the webhook never waits on the probe in flight');
  await drive(clock, pending);
});

test('REFUSE (I3): every read hangs: the answer comes within 4.5 s with L and within 6.5 s without', async () => {
  // With L, and K above L so F runs too: probe 1.5 s, then V, F and a plain miss share 3.0 s.
  const { clock, client, a } = await servedOnce({ floor: true });
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  a.purge();
  client.mode.V = 'fail';
  client.mode.F = 'fail';
  client.mode.Pl = 'fail';
  clock.advance(5_000);
  const kAboveL = await a.shell();
  assert.equal(kAboveL.stale, true, 'control: the probe taught K above L, and every read failed');
  client.mode.probe = 'slow';
  client.mode.V = 'hang';
  client.mode.F = 'hang';
  client.mode.Pl = 'hang';
  clock.advance(6_000);
  const withL = await a.shell();
  assert.ok(withL.ms <= 4_500, `with L: ${withL.ms} ms`);
  assert.ok(!isFloorValue(withL.value), 'L answers');
  // S0: probe 1.5 s, then F 5 s, then the plain read is cache-only.
  const clock2 = fakeClock();
  const client2 = fakeClient(clock2);
  client2.mode.probe = 'slow';
  client2.mode.F = 'hang';
  client2.mode.Pl = 'hang';
  const cold = await instance(client2, clock2, { floor: true }).shell();
  assert.ok(cold.ms <= 6_500, `without L: ${cold.ms} ms`);
});

test('ALLOW (G6, I2, I7): S0 with a cold Client, the fresh read answering at 4.5 s is served, not the plain copy or the floor', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock, { floor: true });
  await a.shell('known');
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  client.mode.probe = 'slow';
  client.mode.F = { delayMs: 4_500 };
  const r = await a.shell();
  assert.ok(has(r, 'new'), `the fresh read, got ${JSON.stringify(pagesOf(r))}`);
  assert.equal(r.stale, false);
});

test('ALLOW (R3, T19): KNOWN at S0 reads plain as today and teaches nothing, so the next FULL render with a slow probe reads fresh', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  const home = await a.shell('known');
  assert.equal(home.stale, false, 'T19: today\'s answer, unmarked');
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  client.mode.probe = 'slow';
  const page = await a.shell();
  assert.ok(has(page, 'new'), 'the page added since answers');
  assert.equal(a.fresh.length, 1, 'F ran: the plain copy taught no version');
});

test('ALLOW (T19b, G4, I4): KNOWN at S0 with the plain read failing answers the floor, marked', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  client.mode.Pl = 'fail';
  const r = await instance(client, clock, { floor: true }).shell('known');
  assert.equal(r.value, BUILD_FLOOR);
  assert.equal(r.stale, true);
});

test('REFUSE (T18, I5, I6): a KNOWN reader never probes and never reads fresh, and reads the known version once there is one', async () => {
  const { clock, client, a, v1 } = await servedOnce();
  const probes = client.probes.length;
  clock.advance(10_000);
  client.mode.probe = 'slow';
  await a.shell('known');
  assert.equal(client.probes.length, probes, 'no probe, even when one is due');
  assert.equal(a.fresh.length, 0);
  assert.equal(vOf(a.asked.at(-1)), v1, 'v = K, never the plain key while K is known');
});

test('ALLOW (section 6, I6): the reader classes', () => {
  const { readerClassFor } = api();
  for (const page of [
    '/[slug]/page',
    '/[slug]/[itemId]/page',
    '/[...segments]/page',
    '/book/page',
    '/booking/manage/page',
    '/og/[slug]/route',
    '/og/[slug]/[itemId]/route',
    '/sitemap.xml/route',
    '/sitemaps/[file]/route',
    '/api/indexnow/urls/route',
  ]) {
    assert.equal(readerClassFor({ type: 'request' }, { page }), 'full', page);
    assert.equal(readerClassFor({ type: 'prerender-legacy' }, { page }), 'known', `${page} regenerating`);
    assert.equal(readerClassFor({ type: 'prerender' }, { page }), 'known', `${page} at build (the glue makes the build PLAIN)`);
  }
  for (const page of ['/page', '/domains/page', '/robots.txt/route', '/icon/route', '/brand/logo/route', '/img/[slug]/[itemId]/route', '/api/revalidate/route']) {
    assert.equal(readerClassFor({ type: 'request' }, { page }), 'known', page);
  }
  assert.equal(readerClassFor(undefined, undefined), 'known', 'outside a render');
});

test('REFUSE (I8): one degraded line per answer that is not the target, none when the target answers (T8)', async () => {
  const { clock, client, a } = await servedOnce();
  clock.advance(6_000);
  await a.shell();
  assert.equal(a.lines.length, 0, 'T8: the target answered');
  a.purge();
  client.mode.V = 'fail';
  clock.advance(6_000);
  await a.shell();
  assert.equal(a.lines.length, 1);
  assert.deepEqual(
    { reader: a.lines[0].reader, target: a.lines[0].target, answeredBy: a.lines[0].answeredBy, stale: a.lines[0].stale },
    { reader: 'full', target: 'V', answeredBy: 'Pl', stale: false },
  );
});

test('REFUSE (I9, T21, T22): the build and a preview learn nothing, and one render\'s edits never reach the next served copy of L', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  await a.shell('plain');
  await a.shell('plain');
  assert.equal(client.probes.length, 0, 'PLAIN never probes');
  assert.deepEqual(a.asked, [SHELL, SHELL], 'PLAIN reads the plain key only: no version, no fresh read');
  client.mode.probe = 'slow';
  clock.advance(1_000);
  client.save(['about', 'compare', 'new']);
  const seed = await a.shell();
  assert.equal(a.fresh.length, 1, 'nothing was learned from the PLAIN reads, so the first FULL read is fresh');
  assert.ok(a.fresh[0] === a.asked[2], 'and that fresh read is the FULL render\'s, the first read after the PLAIN ones');
  // The render that seeded L writes into its own answer (design section 8,
  // review pass 6 N2): L was taken as a clone, so the write never reaches it.
  seed.value?.pages.push('written-by-the-render-that-seeded-L');
  // L served twice: a write into one served copy is not in the next.
  a.purge();
  client.mode.V = 'fail';
  client.mode.Pl = 'fail';
  clock.advance(6_000);
  const one = await a.shell();
  assert.ok(!has(one, 'written-by-the-render-that-seeded-L'), 'L is cloned on the way in');
  one.value?.pages.push('written-by-a-render');
  clock.advance(6_000);
  const two = await a.shell();
  assert.ok(!has(two, 'written-by-a-render'), 'L is cloned on the way out');
});

test('ALLOW (T24, I5): at most one probe per 5 s per instance under a burst of 50 requests', async () => {
  const clock = fakeClock();
  const client = fakeClient(clock);
  const a = instance(client, clock);
  await Promise.all(Array.from({ length: 50 }, () => a.shell()));
  assert.equal(client.probes.length, 1, 'one probe for 50 concurrent requests');
  clock.advance(4_999);
  await Promise.all(Array.from({ length: 50 }, () => a.shell()));
  assert.equal(client.probes.length, 1, 'still one inside the interval');
  clock.advance(1);
  await Promise.all(Array.from({ length: 50 }, () => a.shell()));
  assert.equal(client.probes.length, 2, 'the next interval asks once more');
});

test('REFUSE: no site id never probes and reads as today', async () => {
  const { createSiteVersionFence } = api();
  const clock = fakeClock();
  let probes = 0;
  const fence = createSiteVersionFence({
    siteId: '',
    probe: async () => { probes += 1; return null; },
    now: () => clock.now,
    startTimeout: (ms: number, fn: () => void) => clock.startTimeout(ms, fn),
    startStopwatch: () => clock.startStopwatch(),
  });
  const asked: string[] = [];
  const reads: Reads = { cached: async (p) => { asked.push(p); return { pages: ['x'], updatedAt: null }; }, fresh: async () => ({ value: null, refused: false }), floor: () => null };
  await drive(clock, fence.resolve('full', reads, SHELL, isLive));
  assert.equal(probes, 0);
  assert.deepEqual(asked, [SHELL]);
});

test('the probe wait, the budgets and the deadlines are the design\'s (I3)', () => {
  const n = invalidation as unknown as Record<string, number>; // numeric constants, each compared below
  assert.equal(n.SITE_VERSION_TIMEOUT_MS, 1_500);
  assert.equal(n.SHELL_READS_BUDGET_MS, 3_000);
  assert.equal(n.SHELL_READS_BUDGET_COLD_MS, 5_000);
  assert.equal(n.SHELL_READ_DEADLINE_MS, 1_500);
  assert.equal(n.SHELL_READ_DEADLINE_COLD_MS, 5_000);
  assert.ok(n.SITE_VERSION_TIMEOUT_MS + n.SHELL_READS_BUDGET_COLD_MS <= 6_500, 'FULL at S0 at most 6.5 s');
  assert.ok(n.SITE_VERSION_TIMEOUT_MS + n.SHELL_READS_BUDGET_MS <= 4_500, 'FULL with L at most 4.5 s');
});

test('REFUSE: the floor still answers a versioned read by the key the build wrote', async () => {
  const { versionedPath } = api();
  const h = floorHarness({ siteId: SITE, file: snapshotOf(SITE, { [SHELL]: { pages: ['from-the-build'] } }) });
  const recorded: string[] = [];
  const deps: FloorSeamDeps = {
    memo: createFailureMemo(),
    floor: h.floor,
    recorder: { active: true, record: (path) => recorded.push(path), writeManifest: () => {} },
    now: Date.now,
  };
  const versioned = versionedPath(SHELL, '2026-11-02T22:36:32.000Z');
  const read = (outcome: 'down' | 'up') =>
    readCachedWithFloor<{ pages: string[] } | null>(deps, {
      path: versioned,
      floorPath: SHELL,
      fallback: null,
      floorOptOut: false,
      preview: null,
      read: async () => {
        if (outcome === 'down') throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
        return { pages: ['live'] };
      },
      onFailure: () => {},
      onFallback: () => {},
    });
  assert.deepEqual(await read('down'), { pages: ['from-the-build'] });
  await read('up');
  assert.deepEqual(recorded, [SHELL], 'recorded under the unversioned key');
});

test('SOURCE: one shell call site, the fence on globalThis, a stale answer marked like the floor, the webhook never waits', () => {
  const siteData = fs.readFileSync(new URL('./api/siteData/index.tsx', import.meta.url), 'utf8');
  assert.equal((siteData.match(/clientFetchCached</g) ?? []).length, 1, 'G8, I6: exactly one clientFetchCached call for the shell');
  assert.match(siteData, /readShellThroughFence<SiteDetailsResponse \| null>\(/);
  assert.match(siteData, /fromFloor: source === 'floor' \|\| \(source === 'live' && isFloorValue\(live\)\) \|\| stale/, 'I7: stale is marked like the floor');
  assert.match(siteData, /refused = err instanceof ApiError && err\.status >= 400 && err\.status < 500;/, 'R1: only a 4xx is a refusal');
  assert.match(siteData, /floor: \(\) => floorAnswerFor<SiteDetailsResponse>\(path, 'own_read'\) \?\? null/);
  const glue = fs.readFileSync(new URL('./api/siteData/siteVersionFence.ts', import.meta.url), 'utf8');
  assert.match(glue, /const FENCE: SiteVersionFence = \(slot\[FENCE_SLOT\] \?\?= createSiteVersionFence\(\{/, 'I5: one fence per process');
  assert.match(glue, /readerClassFor\(workUnitAsyncStorage\.getStore\(\), workAsyncStorage\.getStore\(\)\)/);
  assert.match(glue, /startAwakeTimeout\(Math\.max\(0, ms - AWAKE_TICK_MS\), onExpire\)/, 'an awake-time timer, never a wall-clock one, armed one tick early (N3)');
  assert.match(glue, /if \(!SITE_ID \|\| isBuildPhase\(\)\) return 'plain';\s*if \(await isPreviewRender\(\)\) return 'plain';/, 'I9: build and preview are PLAIN');
  assert.match(glue, /const shared = request \? RESOLUTIONS\.get\(request\) : undefined;\s*if \(shared\) return shared/, 'I3: one resolution per request (the 500 pass reuses it)');
  const route = fs.readFileSync(new URL('../app/api/revalidate/route.ts', import.meta.url), 'utf8');
  assert.match(route, /if \(event\.startsWith\("site\."\)\) markSiteVersionProbeDue\(\);/, 'G5: marked, not awaited');
  assert.doesNotMatch(route, /await markSiteVersionProbeDue/);
  const client = fs.readFileSync(new URL('./api/client.ts', import.meta.url), 'utf8');
  assert.match(client, /doClientFetch<unknown>\(CLIENT_API, siteVersionPath\(siteId\), null, \{ signal \}\)/);
  assert.match(client, /path: opts\?\.fresh \? `\$\{path\}#fresh` : path,/, 'I5: concurrent fresh reads share one memo key');
  assert.match(client, /onFailure: \(err\) => \{\s*opts\?\.onUpstreamError\?\.\(err\);/);
  const { siteVersionPath } = api();
  assert.equal(siteVersionPath(SITE), `/tenant/siteVersion?siteId=${SITE}`);
});
