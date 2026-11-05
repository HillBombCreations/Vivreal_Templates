import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as invalidation from './cacheInvalidation.ts';
import { siteDetailsPath } from './api/readPaths.ts';
import { readCachedWithFloor, type FloorSeamDeps } from './api/snapshot/seam.ts';
import { createFailureMemo } from './api/failureMemo.ts';
import { floorHarness, snapshotOf } from './api/snapshot/testSupport.ts';

/**
 * F41 (OD-01, plan 5.T T2): the site version fence, driven as two server
 * instances over one fake VR_Client_API, per the red-proof ideas in vivreal-hq
 * docs/bugs/f41-stale-pages-after-save/research.md. Each instance is a fence
 * and its own data cache keyed by the exact read path, which is how Next's
 * data cache keys `clientFetchCached` (`['vr-client-api', path]`). The real
 * route is driven by `scripts/isr-build-check.mjs` (phase F41).
 *
 * A namespace import, so at a base without the fence each test fails on its
 * own assertion rather than the file failing to load.
 */

const SITE = '6a8d1146a4e1b46a9083e668';
const SHELL = siteDetailsPath(SITE);
const TTL_MS = 300_000;
const T0 = Date.UTC(2026, 10, 2, 22, 36, 0);

type Fn = (...args: unknown[]) => unknown;
type Fence = { versionFor(serving: boolean): Promise<string | null> };

function api() {
  const ns = invalidation as unknown as Record<string, unknown>; // named exports, each checked below
  for (const name of ['createSiteVersionFence', 'versionedPath', 'readSiteVersion', 'isOrdinaryPageRender', 'siteVersionPath']) {
    assert.equal(typeof ns[name], 'function', `cacheInvalidation exports ${name}`);
  }
  return {
    createSiteVersionFence: ns.createSiteVersionFence as (deps: Record<string, unknown>) => Fence,
    versionedPath: ns.versionedPath as (path: string, version: string | null) => string,
    readSiteVersion: ns.readSiteVersion as Fn,
    isOrdinaryPageRender: ns.isOrdinaryPageRender as (u: unknown, w: unknown) => boolean,
    siteVersionPath: ns.siteVersionPath as (id: string) => string,
  };
}

/** One fake VR_Client_API: the stored site, its version, and a 60 s edge copy of each URL. */
function fakeClient() {
  const state = { pages: ['about', 'compare'], updatedAt: '2026-11-02T22:20:00.000Z', writtenAt: T0 - 3_600_000 };
  const edge = new Map<string, { body: { pages: string[] }; at: number }>();
  const probes: string[] = [];
  return {
    state,
    probes,
    save(pages: string[], at: number) {
      state.pages = pages;
      state.updatedAt = new Date(at).toISOString();
      state.writtenAt = at;
    },
    /** GET siteDetails through the edge: a copy younger than 60 s is served as is. */
    shell(path: string, now: number) {
      const hit = edge.get(path);
      if (hit && now - hit.at < 60_000) return hit.body;
      const body = { pages: [...state.pages] };
      edge.set(path, { body, at: now });
      return body;
    },
    version(): unknown {
      probes.push(SITE);
      return { siteId: SITE, updatedAt: state.updatedAt };
    },
  };
}

/** One server instance: its fence, and its own data cache keyed by the read path. */
function instance(client: ReturnType<typeof fakeClient>, clock: { now: number }, probe?: () => Promise<unknown>) {
  const { createSiteVersionFence, versionedPath } = api();
  const cache = new Map<string, { body: { pages: string[] }; at: number }>();
  const reads: string[] = [];
  const fence = createSiteVersionFence({
    siteId: SITE,
    probe: probe ?? (async () => client.version()),
    now: () => clock.now,
    startTimeout: () => ({ cancel() {} }),
  });
  return {
    reads,
    /** The webhook's purge, which only the instance that receives it gets. */
    purge: () => cache.clear(),
    async shell(serving = true): Promise<string[]> {
      const path = versionedPath(SHELL, await fence.versionFor(serving));
      reads.push(path);
      const hit = cache.get(path);
      if (hit && clock.now - hit.at < TTL_MS) return hit.body.pages;
      const body = client.shell(path, clock.now);
      cache.set(path, { body, at: clock.now });
      return body.pages;
    },
  };
}

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
  // The edge copy of the plain URL was refreshed 4 s before the save (22:36:28).
  client.shell(SHELL, clock.now);
  clock.now += 4_000;
  client.save(['about', 'compare', 'linktree'], clock.now);
  a.purge();
  clock.now += 5_000;
  const pages = await a.shell();
  assert.ok(pages.includes('linktree'), `the receiving instance reads the saved site, got ${JSON.stringify(pages)}`);
  const last = a.reads.at(-1) ?? '';
  assert.match(last, new RegExp(`^/tenant/siteDetails\\?siteId=${SITE}&v=`), 'the read after the change carries v');
  assert.equal(new URL(last, 'http://x').searchParams.get('v'), client.state.updatedAt);
});

test('REFUSE: a failed probe leaves the shell read byte for byte today\'s (error, 4xx, 5xx, timeout, another site, no version)', async () => {
  const { createSiteVersionFence, versionedPath } = api();
  const failures: Array<[string, (signal: AbortSignal) => Promise<unknown>]> = [
    ['error', async () => { throw new TypeError('fetch failed'); }],
    ['404', async () => { throw Object.assign(new Error('VR_Client_API 404'), { status: 404 }); }],
    ['500', async () => { throw Object.assign(new Error('VR_Client_API 500'), { status: 500 }); }],
    ['timeout', (signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))],
    ['another site', async () => ({ siteId: '6a0000000000000000000000', updatedAt: '2026-11-02T22:36:32.000Z' })],
    ['no version', async () => ({ siteId: SITE, updatedAt: null })],
    ['not a date', async () => ({ siteId: SITE, updatedAt: 'yesterday' })],
  ];
  for (const [label, probe] of failures) {
    const logged: string[] = [];
    const fence = createSiteVersionFence({
      siteId: SITE,
      probe,
      now: () => T0,
      // The timeout case expires at once; the others never reach it.
      startTimeout: (_ms: number, onExpire: () => void) => {
        if (label === 'timeout') queueMicrotask(onExpire);
        return { cancel() {} };
      },
      onFailure: (reason: string) => logged.push(reason),
    });
    const path = versionedPath(SHELL, await fence.versionFor(true));
    assert.equal(path, SHELL, `${label}: the read is today's, byte for byte`);
    assert.equal(logged.length, 1, `${label}: the failure is logged once`);
  }
});

test('REFUSE: a probe that fails after a success forgets the version, so later reads are today\'s too', async () => {
  const { createSiteVersionFence, versionedPath } = api();
  let up = true;
  const clock = { now: T0 };
  const fence = createSiteVersionFence({
    siteId: SITE,
    probe: async () => {
      if (!up) throw new Error('VR_Client_API 503');
      return { siteId: SITE, updatedAt: '2026-11-02T22:36:32.000Z' };
    },
    now: () => clock.now,
    startTimeout: () => ({ cancel() {} }),
  });
  assert.notEqual(versionedPath(SHELL, await fence.versionFor(true)), SHELL, 'control: a working probe versions the read');
  up = false;
  clock.now += 5_000;
  assert.equal(versionedPath(SHELL, await fence.versionFor(true)), SHELL);
  clock.now += 1_000;
  assert.equal(versionedPath(SHELL, await fence.versionFor(true)), SHELL, 'inside the interval too');
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
  const { createSiteVersionFence, versionedPath } = api();
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
  assert.equal(versionedPath(SHELL, await fence.versionFor(true)), SHELL);
  assert.equal(probes, 0, 'no probe without a site id');
});

test('REFUSE: home, a cached page, a build and a route handler never probe and read as today', async () => {
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
  await b.shell(false);
  assert.equal(client.probes.length, 0, 'not serving an ordinary page: no probe');
  assert.deepEqual(b.reads, [SHELL]);
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

test('ALLOW (review N4): a versioned read that does not come back live tries the plain read before the floor', async () => {
  const fallback = (invalidation as unknown as Record<string, unknown>).readVersionedShell; // a named export, checked next
  assert.equal(typeof fallback, 'function', 'cacheInvalidation exports readVersionedShell');
  const run = fallback as (read: (p: string) => Promise<string | null>, path: string, version: string | null, isLive: (v: string | null) => boolean) => Promise<string | null>; // checked above
  const isLive = (v: string | null) => v !== null && v !== 'floor';
  const V = '2026-11-05T00:00:00.000Z';
  for (const [label, versionedAnswer, want, reads] of [
    ['live', 'saved site', 'saved site', 1],
    ['refused (an older Client answers v with a 400, so the seam gives the floor)', 'floor', 'plain read', 2],
    ['failed with no floor', null, 'plain read', 2],
  ] as const) {
    const paths: string[] = [];
    const out = await run(async (p) => {
      paths.push(p);
      return p.includes('&v=') ? versionedAnswer : 'plain read';
    }, SHELL, V, isLive);
    assert.equal(out, want, label);
    assert.equal(paths.length, reads, `${label}: ${paths.join(' then ')}`);
    assert.ok(paths[0].includes('&v='), `${label}: the versioned read goes first`);
    if (reads === 2) assert.equal(paths[1], SHELL, `${label}: then the plain path, byte for byte`);
  }
  const paths: string[] = [];
  assert.equal(await run(async (p) => { paths.push(p); return 'plain read'; }, SHELL, null, isLive), 'plain read');
  assert.deepEqual(paths, [SHELL], 'no version: one plain read, exactly as before the fence');
});

test('SOURCE: the shell read is versioned only through the fence, with the floor on the plain key', () => {
  const siteData = fs.readFileSync(new URL('./api/siteData/index.tsx', import.meta.url), 'utf8');
  // Re-pointed for review N4: the versioned read now goes through readVersionedShell (tested above).
  assert.match(siteData, /readVersionedShell<SiteDetailsResponse \| null>\(/);
  assert.match(siteData, /path,\s*await shellReadVersion\(\),\s*\(value\) => value !== null && value !== undefined && !isFloorValue\(value\)/);
  assert.match(siteData, /\{ floorPath: path \}/);
  const glue = fs.readFileSync(new URL('./api/siteData/siteVersionFence.ts', import.meta.url), 'utf8');
  assert.match(glue, /isOrdinaryPageRender\(workUnitAsyncStorage\.getStore\(\), workAsyncStorage\.getStore\(\)\)/);
  assert.match(glue, /startAwakeTimeout\(ms, onExpire\)/, 'an awake-time timer, never a wall-clock one');
  const client = fs.readFileSync(new URL('./api/client.ts', import.meta.url), 'utf8');
  assert.match(client, /doClientFetch<unknown>\(CLIENT_API, siteVersionPath\(siteId\), null, \{ signal \}\)/);
  const { siteVersionPath } = api();
  assert.equal(siteVersionPath(SITE), `/tenant/siteVersion?siteId=${SITE}`);
});
