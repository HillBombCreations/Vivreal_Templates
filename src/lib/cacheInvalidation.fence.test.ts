import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as invalidation from './cacheInvalidation.ts';
import { COLD_FETCH_DEADLINE_MS } from './edgeSiteMap.ts';
import { siteDetailsPath } from './api/readPaths.ts';
import { readCachedWithFloor, type FloorSeamDeps } from './api/snapshot/seam.ts';
import { createFailureMemo } from './api/failureMemo.ts';
import { floorHarness, snapshotOf } from './api/snapshot/testSupport.ts';

/**
 * F41 (OD-01, plan 5.T T2) and RW-4 (vivreal-hq rewalk-2026-11-defects.md):
 * the site version fence, driven as server instances over one fake
 * VR_Client_API. Each instance is a fence, its own data cache keyed by the
 * exact read path (how Next's data cache keys `clientFetchCached`,
 * `['vr-client-api', path]`), and the production read decision `readShell`.
 * The fake Client keeps a 60 s edge copy of every URL, as client.vivreal.io
 * does. The real route is driven by `scripts/isr-build-check.mjs` (phase F41).
 *
 * A namespace import, so at a base without the fence each test fails on its
 * own assertion rather than the file failing to load.
 */

const SITE = '6a8d1146a4e1b46a9083e668';
const SHELL = siteDetailsPath(SITE);
const TTL_MS = 300_000;
const T0 = Date.UTC(2026, 10, 9, 15, 6, 0);
const iso = (ms: number) => new Date(ms).toISOString();

type Body = { pages: string[]; updatedAt: string | null };
type Fence = { shellReadFor(serving: boolean): Promise<unknown>; learn(version: unknown): void };
type Reads<T> = { cached(path: string): Promise<T>; fresh(): Promise<T> };
type ReadShell = <T extends { readonly updatedAt?: unknown } | null | undefined>(
  fence: Fence,
  serving: boolean,
  reads: Reads<T>,
  path: string,
  isLive: (value: T) => boolean,
) => Promise<T>;

function api() {
  const ns = invalidation as unknown as Record<string, unknown>; // named exports, each checked below
  for (const name of ['createSiteVersionFence', 'versionedPath', 'readSiteVersion', 'isOrdinaryPageRender', 'siteVersionPath', 'readShell']) {
    assert.equal(typeof ns[name], 'function', `cacheInvalidation exports ${name}`);
  }
  return {
    createSiteVersionFence: ns.createSiteVersionFence as (deps: Record<string, unknown>) => Fence,
    versionedPath: ns.versionedPath as (path: string, version: string | null) => string,
    isOrdinaryPageRender: ns.isOrdinaryPageRender as (u: unknown, w: unknown) => boolean,
    siteVersionPath: ns.siteVersionPath as (id: string) => string,
    readShell: ns.readShell as ReadShell,
  };
}

/** One fake VR_Client_API: the stored site, its version, and a 60 s edge copy of each URL. */
function fakeClient() {
  const state = { pages: ['about', 'compare'], updatedAt: '2026-11-09T14:20:00.000Z' as string | null };
  const edge = new Map<string, { body: Body; at: number }>();
  const probes: string[] = [];
  return {
    state,
    probes,
    save(pages: string[], at: number) {
      state.pages = pages;
      state.updatedAt = iso(at);
    },
    /** GET siteDetails through the edge: a copy younger than 60 s is served as is. */
    shell(path: string, now: number): Body {
      const hit = edge.get(path);
      if (hit && now - hit.at < 60_000) return hit.body;
      const body = { pages: [...state.pages], updatedAt: state.updatedAt };
      edge.set(path, { body, at: now });
      return body;
    },
    version(): unknown {
      probes.push(SITE);
      return { siteId: SITE, updatedAt: state.updatedAt };
    },
  };
}

type ProbeMode = 'up' | 'timeout' | 'error';

/**
 * One server instance: its fence, its own data cache keyed by the read path,
 * and the two reads `readShell` makes (the cached one, and the fresh one that
 * skips this cache and carries its own start instant as `v`).
 */
function instance(client: ReturnType<typeof fakeClient>, clock: { now: number }, probe?: (signal: AbortSignal) => Promise<unknown>) {
  const { createSiteVersionFence, versionedPath, readShell } = api();
  const cache = new Map<string, { body: Body; at: number }>();
  const reads: string[] = [];
  const fresh: string[] = [];
  let mode: ProbeMode = 'up';
  const fence = createSiteVersionFence({
    siteId: SITE,
    probe:
      probe ??
      ((signal: AbortSignal) => {
        if (mode === 'error') return Promise.reject(new Error('VR_Client_API 503'));
        // A slow Client: no answer until the timeout aborts it.
        if (mode === 'timeout') return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
        return Promise.resolve(client.version());
      }),
    now: () => clock.now,
    startTimeout: (_ms: number, onExpire: () => void) => {
      if (mode === 'timeout') queueMicrotask(onExpire);
      return { cancel() {} };
    },
  });
  const reader: Reads<Body> = {
    async cached(path) {
      reads.push(path);
      const hit = cache.get(path);
      if (hit && clock.now - hit.at < TTL_MS) return hit.body;
      const body = client.shell(path, clock.now);
      cache.set(path, { body, at: clock.now });
      return body;
    },
    async fresh() {
      const path = versionedPath(SHELL, iso(clock.now));
      reads.push(path);
      fresh.push(path);
      return client.shell(path, clock.now);
    },
  };
  return {
    reads,
    fresh,
    probeMode(next: ProbeMode) {
      mode = next;
    },
    /** The webhook's purge, which only the instance that receives it gets. */
    purge: () => cache.clear(),
    /** `serving` false is home, a cached page or a route handler: today's read. */
    async shell(serving = true): Promise<string[]> {
      return (await readShell<Body>(fence, serving, reader, SHELL, (value) => value !== null)).pages;
    },
  };
}

const has = (pages: string[], page: string) => pages.includes(page);

test('ALLOW (two instances): a save the webhook never told instance B about shows on B within one probe interval', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  const a = instance(client, clock);
  const b = instance(client, clock);
  assert.deepEqual(new Set(await a.shell()), new Set(['about', 'compare']));
  assert.deepEqual(new Set(await b.shell()), new Set(['about', 'compare']), 'control: B holds the shell from before the save');

  clock.now += 2_000;
  client.save(['about', 'compare', 'product/phone-app'], clock.now);
  a.purge(); // the webhook reaches A only
  clock.now += invalidation.SITE_VERSION_INTERVAL_MS ?? 5_000;
  assert.deepEqual(new Set(await b.shell()), new Set(['about', 'compare', 'product/phone-app']), 'B lists the new page');
  assert.deepEqual(new Set(await a.shell()), new Set(['about', 'compare', 'product/phone-app']));
});

test('ALLOW (edge race): after a save the shell read carries the new version, so a pre-save edge copy is never re-cached', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  const a = instance(client, clock);
  await a.shell();
  // The edge copy of the plain URL was refreshed 4 s before the save.
  client.shell(SHELL, clock.now);
  clock.now += 4_000;
  client.save(['about', 'compare', 'linktree'], clock.now);
  a.purge();
  clock.now += 5_000;
  const pages = await a.shell();
  assert.ok(has(pages, 'linktree'), `the receiving instance reads the saved site, got ${JSON.stringify(pages)}`);
  const last = a.reads.at(-1) ?? '';
  assert.match(last, new RegExp(`^/tenant/siteDetails\\?siteId=${SITE}&v=`), 'the read after the change carries v');
  assert.equal(new URL(last, 'http://x').searchParams.get('v'), client.state.updatedAt);
});

test('REFUSE (RW-4 row 1): after a save, a probe timeout on an instance that served the new version still serves the new version', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  const a = instance(client, clock);
  // Warm, and the home page's plain read caches the shell from before the save (RW-4's warm reads).
  await a.shell();
  await a.shell(false);
  clock.now += 22_000;
  client.save(['about', 'compare', 'qa-test-rewalk-t2-about'], clock.now);
  clock.now += 30_000;
  assert.ok(has(await a.shell(), 'qa-test-rewalk-t2-about'), 'control: the instance served the saved site');
  const saved = client.state.updatedAt ?? '';

  a.probeMode('timeout');
  for (const step of [60_000, 90_000, 5_000, 5_000]) {
    clock.now += step;
    const from = a.reads.length;
    const pages = await a.shell();
    assert.ok(has(pages, 'qa-test-rewalk-t2-about'), `+${step} ms with the probe timing out: still the saved site, got ${JSON.stringify(pages)}`);
    assert.ok(!a.reads.slice(from).includes(SHELL), 'never the plain key once a version is known');
    assert.equal(new URL(a.reads.at(-1) ?? '', 'http://x').searchParams.get('v'), saved, 'the kept version');
  }
  assert.equal(a.fresh.length, 0, 'a kept version is read through the caches, never fresh on every failed probe');
  // The same holds for an error or a 5xx.
  a.probeMode('error');
  clock.now += 5_000;
  assert.ok(has(await a.shell(), 'qa-test-rewalk-t2-about'), 'a failed probe keeps the version too');
});

test('REFUSE (RW-4 row 2): a first read with a failed probe never serves an entry older than the stored site', async () => {
  const kinds: Array<[string, ProbeMode | ((signal: AbortSignal) => Promise<unknown>)]> = [
    ['timeout', 'timeout'],
    ['error', 'error'],
    ['404', async () => { throw Object.assign(new Error('VR_Client_API 404'), { status: 404 }); }],
    ['500', async () => { throw Object.assign(new Error('VR_Client_API 500'), { status: 500 }); }],
    ['another site', async () => ({ siteId: '6a0000000000000000000000', updatedAt: '2026-11-09T15:06:46.367Z' })],
    ['not a date', async () => ({ siteId: SITE, updatedAt: 'yesterday' })],
  ];
  for (const [label, kind] of kinds) {
    // (a) this instance's own plain copy predates the save (it served the home page).
    const client = fakeClient();
    const clock = { now: T0 };
    const a = instance(client, clock, typeof kind === 'function' ? kind : undefined);
    if (typeof kind === 'string') a.probeMode(kind);
    assert.ok(!has(await a.shell(false), 'new'), `${label}: control, the plain copy is from before the save`);
    clock.now += 2_000;
    client.save(['about', 'compare', 'new'], clock.now);
    clock.now += 1_000;
    const from = a.reads.length;
    assert.ok(has(await a.shell(), 'new'), `${label}: the first ordinary read shows the stored site`);
    assert.ok(!a.reads.slice(from).includes(SHELL), `${label}: not the plain key`);
    assert.equal(a.fresh.length, 1, `${label}: one fresh read`);
    // Its version is kept: the next read goes through the caches by it, not fresh again.
    clock.now += 1_000;
    assert.ok(has(await a.shell(), 'new'), `${label}: still the stored site`);
    assert.equal(a.reads.at(-1), invalidation.versionedPath(SHELL, client.state.updatedAt), `${label}: read by the version the fresh read carried`);
    assert.equal(a.fresh.length, 1, `${label}: no second fresh read`);

    // (b) a cold instance, but client.vivreal.io holds a plain copy from before the save.
    const client2 = fakeClient();
    const clock2 = { now: T0 };
    client2.shell(SHELL, clock2.now); // another instance read the plain URL
    clock2.now += 2_000;
    client2.save(['about', 'compare', 'new'], clock2.now);
    clock2.now += 1_000;
    const cold = instance(client2, clock2, typeof kind === 'function' ? kind : undefined);
    if (typeof kind === 'string') cold.probeMode(kind);
    assert.ok(has(await cold.shell(), 'new'), `${label}: a cold instance never takes the edge's plain copy from before the save`);
  }
});

test('ALLOW: a site whose Client answers "no version" reads the plain key, never fresh on every page', async () => {
  const client = fakeClient();
  client.state.updatedAt = null;
  const clock = { now: T0 };
  const a = instance(client, clock);
  for (let i = 0; i < 3; i += 1) {
    await a.shell();
    clock.now += 5_000;
  }
  assert.deepEqual(a.reads, [SHELL, SHELL, SHELL]);
  assert.equal(a.fresh.length, 0);
});

test('ALLOW (RW-4 row 3): a probe that recovers moves forward to a newer version', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  const a = instance(client, clock);
  await a.shell(false); // the plain copy, from before both saves
  clock.now += 1_000;
  client.save(['about', 'compare', 'menu'], clock.now);
  clock.now += 5_000;
  assert.ok(has(await a.shell(), 'menu'));
  const first = client.state.updatedAt;

  a.probeMode('error');
  clock.now += 5_000;
  assert.ok(has(await a.shell(), 'menu'), 'down: the known version holds');
  clock.now += 1_000;
  client.save(['about', 'compare', 'menu', 'new'], clock.now);
  clock.now += 5_000;
  assert.equal(new URL(a.reads.at(-1) ?? '', 'http://x').searchParams.get('v'), first, 'control: still down, still the first version');

  a.probeMode('up');
  clock.now += 5_000;
  assert.ok(has(await a.shell(), 'new'), 'recovered: the newer save shows');
  assert.equal(a.reads.at(-1), invalidation.versionedPath(SHELL, client.state.updatedAt));
});

test('REFUSE: an older answer (a lagging read) never moves the version back', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  let answer: unknown = { siteId: SITE, updatedAt: '2026-11-09T15:06:46.367Z' };
  const a = instance(client, clock, async () => answer);
  await a.shell();
  answer = { siteId: SITE, updatedAt: '2026-11-09T15:06:40.000Z' };
  clock.now += 5_000;
  await a.shell();
  assert.equal(new URL(a.reads.at(-1) ?? '', 'http://x').searchParams.get('v'), '2026-11-09T15:06:46.367Z');
});

test('ALLOW (RW-4 row 4): the pair converges, and the instance whose probe timed out never goes back meanwhile', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  const a = instance(client, clock);
  const b = instance(client, clock);
  // Both served the home page from the plain key before the first save.
  await a.shell(false);
  await b.shell(false);
  clock.now += 1_000;
  client.save(['about', 'compare', 'menu'], clock.now);
  clock.now += 5_000;
  assert.ok(has(await a.shell(), 'menu') && has(await b.shell(), 'menu'), 'control: both served the first save');
  const first = client.state.updatedAt;

  clock.now += 2_000;
  client.save(['about', 'compare', 'menu', 'new'], clock.now);
  clock.now += 5_000;
  b.probeMode('timeout');
  assert.ok(has(await a.shell(), 'new'), 'A: probe up, the second save');
  const onB = await b.shell();
  assert.ok(has(onB, 'menu'), `B: probe timed out, still the first save it served, got ${JSON.stringify(onB)}`);
  assert.equal(b.reads.at(-1), invalidation.versionedPath(SHELL, first), 'B: by the version it knew, through its caches');
  assert.equal(b.fresh.length, 0, 'B: no fresh read while it knows a version');

  b.probeMode('up');
  clock.now += 5_000;
  const [onA, onB2] = [await a.shell(), await b.shell()];
  assert.deepEqual(onB2, onA, 'the pair serves the same site');
  assert.ok(has(onB2, 'new'));
  assert.equal(a.reads.at(-1), b.reads.at(-1), 'by the same key');
});

test('ALLOW (review N4, re-pointed for RW-4): a versioned read that does not come back live reads fresh, never the plain key', async () => {
  const { createSiteVersionFence, readShell } = api();
  type Answer = { name: string; updatedAt?: string } | null;
  const V = '2026-11-09T15:06:46.367Z';
  const isLive = (value: Answer) => value !== null && value.name !== 'floor';
  for (const [label, versionedAnswer, freshAnswer, want, reads] of [
    ['live', 'saved site', 'unused', 'saved site', ['versioned']],
    ['refused or failed (the seam gave the floor)', 'floor', 'fresh site', 'fresh site', ['versioned', 'fresh']],
    ['failed with no floor', null, 'fresh site', 'fresh site', ['versioned', 'fresh']],
    ['the fresh read failed too', 'floor', 'floor', 'floor', ['versioned', 'fresh']],
  ] as const) {
    const fence = createSiteVersionFence({ siteId: SITE, probe: async () => ({ siteId: SITE, updatedAt: V }), now: () => T0, startTimeout: () => ({ cancel() {} }) });
    const seen: string[] = [];
    const out = await readShell<Answer>(
      fence,
      true,
      {
        async cached(path) {
          seen.push(path === SHELL ? 'plain' : 'versioned');
          return versionedAnswer === null ? null : { name: versionedAnswer };
        },
        async fresh() {
          seen.push('fresh');
          return { name: freshAnswer };
        },
      },
      SHELL,
      isLive,
    );
    assert.equal(out?.name, want, label);
    assert.deepEqual(seen, reads, `${label}: ${seen.join(' then ')}`);
  }
});

test('ALLOW: a first read whose fresh read also fails takes the plain read (today\'s outage answer) and learns nothing from it', async () => {
  const { createSiteVersionFence, readShell } = api();
  type Answer = { name: string; updatedAt?: string } | null;
  const fence = createSiteVersionFence({ siteId: SITE, probe: async () => { throw new Error('fetch failed'); }, now: () => T0, startTimeout: () => ({ cancel() {} }) });
  const seen: string[] = [];
  const reads = {
    async cached(path: string): Promise<Answer> {
      seen.push(path);
      return { name: 'plain copy', updatedAt: '2026-11-09T14:00:00.000Z' };
    },
    async fresh(): Promise<Answer> {
      seen.push('fresh');
      return null;
    },
  };
  const isLive = (value: Answer) => value !== null;
  assert.equal((await readShell<Answer>(fence, true, reads, SHELL, isLive))?.name, 'plain copy');
  assert.deepEqual(seen, ['fresh', SHELL]);
  assert.deepEqual(await fence.shellReadFor(true), { kind: 'fresh' }, 'the plain copy taught it no version');
});

test('ALLOW: at most one probe per 5 s per instance under a burst of 50 requests', async () => {
  const client = fakeClient();
  const clock = { now: T0 };
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const b = instance(client, clock, async () => {
    await gate;
    return client.version();
  });
  const burst = Array.from({ length: 50 }, () => b.shell());
  release();
  await Promise.all(burst);
  assert.equal(client.probes.length, 1, 'one probe for 50 concurrent requests');
  clock.now += 4_999;
  await Promise.all(Array.from({ length: 50 }, () => b.shell()));
  assert.equal(client.probes.length, 1, 'still one inside the interval');
  clock.now += 1;
  await Promise.all(Array.from({ length: 50 }, () => b.shell()));
  assert.equal(client.probes.length, 2, 'the next interval asks once more');
  assert.ok(b.reads.every((r) => r.includes('&v=')), 'every read in the burst carries the version');
});

test('REFUSE: no site id (a local or preview build) never probes and reads as today', async () => {
  const { createSiteVersionFence } = api();
  let probes = 0;
  const fence = createSiteVersionFence({
    siteId: '',
    probe: async () => {
      probes += 1;
      return { siteId: '', updatedAt: '2026-11-02T22:36:32.000Z' };
    },
    now: () => T0,
    startTimeout: () => ({ cancel() {} }),
  });
  assert.deepEqual(await fence.shellReadFor(true), { kind: 'plain' });
  assert.equal(probes, 0, 'no probe without a site id');
});

test('REFUSE: home, a cached page, a build and a route handler never probe, never read fresh, and read as today', async () => {
  const { isOrdinaryPageRender } = api();
  assert.equal(isOrdinaryPageRender({ type: 'request' }, { page: '/[slug]/page' }), true, 'control: an ordinary page served per request');
  assert.equal(isOrdinaryPageRender({ type: 'request' }, { page: '/[slug]/[itemId]/page' }), true);
  assert.equal(isOrdinaryPageRender({ type: 'request' }, { page: '/page' }), false, 'home keeps its timing');
  assert.equal(isOrdinaryPageRender({ type: 'prerender-legacy' }, { page: '/[slug]/page' }), false, 'a regeneration of a cached page');
  assert.equal(isOrdinaryPageRender({ type: 'prerender' }, { page: '/[slug]/page' }), false, 'a build prerender');
  assert.equal(isOrdinaryPageRender({ type: 'request' }, { page: '/sitemap.xml/route' }), false, 'a route handler');
  assert.equal(isOrdinaryPageRender(undefined, undefined), false, 'outside a render');
  const client = fakeClient();
  const b = instance(client, { now: T0 });
  b.probeMode('error');
  await b.shell(false);
  assert.equal(client.probes.length, 0, 'not serving an ordinary page: no probe');
  assert.deepEqual(b.reads, [SHELL]);
  assert.equal(b.fresh.length, 0, 'an uncached read would turn a cached page dynamic');
});

test('REFUSE: a fresh shell read that is not an ISO instant teaches the fence nothing', async () => {
  const { createSiteVersionFence } = api();
  const fence = createSiteVersionFence({ siteId: SITE, probe: async () => { throw new Error('down'); }, now: () => T0, startTimeout: () => ({ cancel() {} }) });
  for (const bad of [null, undefined, 'yesterday', 42, '2026-11-09 15:06:46']) fence.learn(bad);
  assert.deepEqual(await fence.shellReadFor(true), { kind: 'fresh' });
  fence.learn('2026-11-09T15:06:46.367Z');
  assert.deepEqual(await fence.shellReadFor(true), { kind: 'versioned', version: '2026-11-09T15:06:46.367Z' }, 'control: an instant is learned');
});

test('the probe timeout holds a warm Client and stays inside the cold lookup budget', () => {
  // RW-4 measured warm probes at 524 to 566 ms end to end against a 500 ms bound.
  assert.ok(invalidation.SITE_VERSION_TIMEOUT_MS >= 2 * 566, `at least twice the slowest warm probe, got ${invalidation.SITE_VERSION_TIMEOUT_MS}`);
  assert.ok(invalidation.SITE_VERSION_TIMEOUT_MS <= COLD_FETCH_DEADLINE_MS, 'never longer than the cold site map lookup a visitor already waits for');
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

test('SOURCE: the shell read goes through the fence, the fresh read skips the data cache on its own memo key, the floor stays on the plain key', () => {
  const siteData = fs.readFileSync(new URL('./api/siteData/index.tsx', import.meta.url), 'utf8');
  // Re-pointed for RW-4: readShellThroughFence replaces readVersionedShell, with a fresh read of the plain path.
  assert.match(siteData, /readShellThroughFence<SiteDetailsResponse \| null>\(/);
  assert.match(siteData, /\{ cached: \(readPath\) => read\(readPath\), fresh: \(\) => read\(path, \{ fresh: true \}\) \}/);
  assert.match(siteData, /\{ floorPath: path, \.\.\.opts \}/);
  assert.doesNotMatch(siteData, /readVersionedShell|shellReadVersion/);
  const glue = fs.readFileSync(new URL('./api/siteData/siteVersionFence.ts', import.meta.url), 'utf8');
  assert.match(glue, /isOrdinaryPageRender\(workUnitAsyncStorage\.getStore\(\), workAsyncStorage\.getStore\(\)\)/);
  assert.match(glue, /startAwakeTimeout\(ms, onExpire\)/, 'an awake-time timer, never a wall-clock one');
  assert.match(glue, /return readShell\(FENCE, servesOrdinaryPage\(\), reads, path, isLive\);/);
  const client = fs.readFileSync(new URL('./api/client.ts', import.meta.url), 'utf8');
  assert.match(client, /doClientFetch<unknown>\(CLIENT_API, siteVersionPath\(siteId\), null, \{ signal \}\)/);
  assert.match(client, /path: opts\?\.fresh \? `\$\{path\}#fresh` : path,/, 'a fresh read never joins a cached read of the same path');
  assert.match(client, /read: opts\?\.fresh \? fresh : cached,/);
  const { siteVersionPath } = api();
  assert.equal(siteVersionPath(SITE), `/tenant/siteVersion?siteId=${SITE}`);
});
