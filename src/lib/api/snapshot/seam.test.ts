import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readCachedWithFloor, type FloorSeamDeps } from './seam.ts';
import { createFailureMemo } from '../failureMemo.ts';
import { readOrDegrade } from '../degradedRead.ts';
import { floorHarness, snapshotOf, type FloorHarness } from './testSupport.ts';
import { collectionObjectsPath, integrationObjectsPath, siteDetailsPath } from '../readPaths.ts';
import { FORCE_FLOOR_SITE_IDS } from './constants.ts';
import type { SnapshotFile } from './floor.ts';

/**
 * T2, the seam halves of T6, and the runtime half of T15
 * (site-first-read-fallback plan). `readCachedWithFloor` is exactly what
 * `clientFetchCached` runs; this drives it with the REAL failure memo and the
 * REAL floor, faking only the network read and the file bytes.
 */

const SITE = '6900a3f732b0727413c502b7';
const MENU = collectionObjectsPath('menu', { limit: 100 });
const SOLD = collectionObjectsPath('sold-here', { limit: 100 });
const STRIPE = integrationObjectsPath('stripe', { limit: 100 });
const MENU_FLOOR = { items: [{ _id: 'i1', objectValue: { title: 'Lemon Tart' } }], totalCount: 1, richTextImageUrls: {} };

type Page = { items: unknown[]; totalCount: number; richTextImageUrls?: Record<string, string> };

function seam(siteId: string, file: SnapshotFile | null) {
  const h: FloorHarness = floorHarness({ siteId, file });
  const recorded: Array<{ path: string; value: unknown }> = [];
  const deps: FloorSeamDeps = {
    memo: createFailureMemo(),
    floor: h.floor,
    recorder: { active: true, record: (path, value) => recorded.push({ path, value }), writeManifest: () => {} },
    now: Date.now,
  };
  let upstreamCalls = 0;
  const failures: unknown[] = [];
  const fallbacks: unknown[] = [];
  const read = <T>(path: string, outcome: 'down' | T, opts: { floorOptOut?: boolean; preview?: () => Promise<T> } = {}) =>
    (fallback: T) =>
      readCachedWithFloor<T>(deps, {
        path,
        fallback,
        floorOptOut: opts.floorOptOut ?? false,
        preview: opts.preview ?? null,
        read: async () => {
          upstreamCalls += 1;
          if (outcome === 'down') throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
          return outcome;
        },
        onFailure: (err) => failures.push(err),
        onFallback: (err) => fallbacks.push(err),
      });
  return { h, recorded, read, upstream: () => upstreamCalls, failures, fallbacks };
}

const file = (extra: Partial<SnapshotFile> = {}) =>
  snapshotOf(SITE, { [MENU]: MENU_FLOOR, [SOLD]: { items: [{ price: 9 }], totalCount: 1 } }, extra);
const empty = (): Page => ({ items: [], totalCount: 0, richTextImageUrls: {} });

test('T2 REFUSE: a failing read of an eligible path answers the floor, fromFloor true, degraded false', async () => {
  const s = seam(SITE, file());
  const out = await readOrDegrade<Page>(empty, s.read<Page>(MENU, 'down'));
  assert.equal(out.degraded, false);
  assert.equal(out.fromFloor, true);
  assert.deepEqual(out.value, MENU_FLOOR);
  assert.equal(s.failures.length, 1, 'the live-read failure is still captured (TEMPLATES-6/-7/-F stay real)');
  assert.equal(s.fallbacks.length, 0, 'no "returning fallback" line for a floor answer');
  assert.equal(s.h.events('site.snapshot.floor')[0].reason, 'own_read');
});

test('T2: mutating a floor answer does not change the next one', async () => {
  const s = seam(SITE, file());
  const a = await readOrDegrade<Page>(empty, s.read<Page>(MENU, 'down'));
  (a.value.items[0] as { objectValue: { title: string } }).objectValue.title = 'MUTATED';
  const b = await readOrDegrade<Page>(empty, s.read<Page>(MENU, 'down'));
  assert.equal((b.value.items[0] as { objectValue: { title: string } }).objectValue.title, 'Lemon Tart');
});

test('T2 REFUSE: a product read answers the sentinel (degraded), never the floor', async () => {
  const s = seam(SITE, snapshotOf(SITE, { [STRIPE]: { items: [{ price: 1 }], totalCount: 1 } }));
  const out = await readOrDegrade<Page>(empty, s.read<Page>(STRIPE, 'down'));
  assert.equal(out.degraded, true);
  assert.equal(out.fromFloor, false);
});

test('T2 REFUSE: { floor: false } answers the sentinel even when the snapshot holds the key', async () => {
  const s = seam(SITE, file());
  const out = await readOrDegrade<Page>(empty, s.read<Page>(MENU, 'down', { floorOptOut: true }));
  assert.equal(out.degraded, true);
  assert.equal(out.fromFloor, false);
});

test('T2 REFUSE: an excluded storefront collection answers the sentinel', async () => {
  const s = seam(SITE, file({ excludedCollectionIds: ['sold-here'] }));
  const out = await readOrDegrade<Page>(empty, s.read<Page>(SOLD, 'down'));
  assert.equal(out.degraded, true);
});

test('T2 REFUSE: a snapshot built for another siteId is ignored', async () => {
  const s = seam(SITE, snapshotOf('68bfac783bc7c024975c90cb', { [MENU]: MENU_FLOOR }));
  const out = await readOrDegrade<Page>(empty, s.read<Page>(MENU, 'down'));
  assert.equal(out.degraded, true);
});

test('T2 ALLOW: a live success wins, is recorded for the build, and is not a floor value', async () => {
  const live = { items: [{ _id: 'live' }], totalCount: 1, richTextImageUrls: {} };
  const s = seam(SITE, file());
  const out = await readOrDegrade<Page>(empty, s.read<Page>(MENU, live));
  assert.equal(out.value, live);
  assert.equal(out.fromFloor, false);
  assert.deepEqual(s.recorded, [{ path: MENU, value: live }]);
  assert.equal(s.h.fullReads(), 0, 'the happy path never parses the snapshot');
});

test('T6 seam: a read served by the data cache without any network call is recorded too', async () => {
  // The seam wraps whatever `read` is; in production that is the
  // unstable_cache function, which answers a build-time cache hit without a
  // fetch. Recording sits outside it, so the hit is recorded.
  const s = seam(SITE, null);
  const cachedHit = { items: [{ _id: 'from-cache' }], totalCount: 1 };
  await s.read<Page>(MENU, cachedHit)(empty());
  assert.equal(s.recorded.length, 1);
});

test('T6 seam REFUSE: a preview read is never recorded and never floored', async () => {
  const s = seam(SITE, file());
  const previewValue = { items: [{ _id: 'draft' }], totalCount: 1 };
  const out = await s.read<Page>(MENU, 'down', { preview: async () => previewValue })(empty());
  assert.equal(out, previewValue);
  assert.equal(s.recorded.length, 0);
  assert.equal(s.upstream(), 0);
  assert.equal(s.h.events('site.snapshot.floor').length, 0);
});

test('T6 seam REFUSE: an opted-out success is not recorded', async () => {
  const s = seam(SITE, null);
  await s.read<Page>(MENU, { items: [], totalCount: 0 }, { floorOptOut: true })(empty());
  assert.equal(s.recorded.length, 0);
});

test('siteDetails: a failed read answers the floor shell, marked', async () => {
  const key = siteDetailsPath(SITE);
  const shell = { name: 'Floor Cafe', siteDetails: { values: { a: 1 } } };
  const s = seam(SITE, snapshotOf(SITE, { [key]: shell }));
  const out = await s.read<typeof shell | null>(key, 'down')(null);
  assert.deepEqual(out, shell);
});

/* ------------------------------------------------- T15, runtime forced floor */

const QA = FORCE_FLOOR_SITE_IDS[0];
const QA_MENU_FILE = (forceFloor: boolean, siteId = QA) => snapshotOf(siteId, { [MENU]: MENU_FLOOR }, { forceFloor });

test('T15 ALLOW: with a forced floor, an eligible read answers from the floor without calling upstream', async () => {
  const s = seam(QA, QA_MENU_FILE(true));
  const live = { items: [{ _id: 'live' }], totalCount: 1 };
  const out = await s.read<Page>(MENU, live)(empty());
  assert.deepEqual(out, MENU_FLOOR);
  assert.equal(s.upstream(), 0);
  assert.equal(s.h.events('site.snapshot.floor')[0].reason, 'forced');
});

test('T15 REFUSE: a forced floor never forces an opted-out (product) read', async () => {
  const s = seam(QA, QA_MENU_FILE(true));
  const live = { items: [{ _id: 'live' }], totalCount: 1 };
  assert.equal(await s.read<Page>(MENU, live, { floorOptOut: true })(empty()), live);
  assert.equal(s.upstream(), 1);
});

test('T15 REFUSE: forceFloor in a file on a site outside FORCE_FLOOR_SITE_IDS goes upstream as normal', async () => {
  const s = seam(SITE, QA_MENU_FILE(true, SITE));
  const live = { items: [{ _id: 'live' }], totalCount: 1 };
  assert.equal(await s.read<Page>(MENU, live)(empty()), live);
  assert.equal(s.upstream(), 1);
});
