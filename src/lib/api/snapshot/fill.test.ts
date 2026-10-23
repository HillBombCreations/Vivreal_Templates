import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { FILL_CONCURRENCY, fillSnapshotAtBuild, planSnapshotFill, usesProductBridge, type BindingTargetsLike } from './fill.ts';
import { storefrontCollectionIds } from './storefrontExclusion.ts';
import { FORCE_FLOOR_SITE_IDS } from './constants.ts';

/**
 * T16 and T14 (site-first-read-fallback plan, review-2 note 1 folded in).
 *
 * The expected keys are asserted as LITERAL strings in the production key
 * shape (`limit=100&collectionId=...`, measured over every failed read 10-16
 * to 10-23). A planner that built one key in another parameter order, or with
 * a limit the runtime does not use, fails here, which is the whole point:
 * such a key is a floor that is present and never used.
 */

const SITE = 'site-1';

// Cast: a fixture carries only the PageConfig fields the planner reads.
const page = (p: Record<string, unknown>) => p as unknown as PageConfig;

const HOME = page({ slug: 'home', format: 'home', name: 'Home' });
const PAGES: PageConfig[] = [
  page({ slug: 'menu', format: 'static', name: 'Menu' }),
  page({
    slug: 'shop',
    format: 'products',
    name: 'Shop',
    detailPage: {
      itemCollectionId: 'resale',
      integrations: [{ type: 'Instagram' }, { type: 'stripe' }, { name: 'tiktok' }],
    },
  }),
  page({ slug: 'features/ai-sites', format: 'static', name: 'AI sites' }),
  page({ slug: 'features/off', format: 'static', name: 'Off nested', enabled: false }),
  page({ slug: 'deep/shop', format: 'products', name: 'Nested shop' }),
  page({
    slug: 'events',
    format: 'collection-list',
    name: 'Events',
    detailPage: { context: { collectionId: 'locations', match: { field: 'slug', value: 'moraga' } } },
  }),
  page({ slug: 'old', format: 'static', name: 'Old', enabled: false }),
  page({ slug: 'subscribers', format: 'subscribers', name: 'Subscribers' }),
];

const TARGETS: Record<string, BindingTargetsLike> = {
  home: { collectionIds: ['menu-col'], integrationTypes: ['tiktok'] },
  menu: { collectionIds: ['menu-col'], integrationTypes: [] },
  shop: { collectionIds: ['resale', 'filters'], integrationTypes: ['stripe'] },
  'features/ai-sites': { collectionIds: ['specials'], integrationTypes: ['LinkedIn'] },
  'features/off': { collectionIds: ['never'], integrationTypes: [] },
  'deep/shop': { collectionIds: ['never-2'], integrationTypes: [] },
  events: { collectionIds: ['events-col'], integrationTypes: [] },
  old: { collectionIds: ['old-col'], integrationTypes: [] },
  subscribers: { collectionIds: ['subs'], integrationTypes: [] },
};
const targetsOf = (p: PageConfig) => TARGETS[p.slug as string] ?? { collectionIds: [], integrationTypes: [] };
const SITE_DATA = { pageConfigs: PAGES, homePageConfig: HOME } as Pick<SiteData, 'pageConfigs' | 'homePageConfig'>;

test('T16: the manifest lists exactly the row 1 to 6 keys, in the runtime key shape', () => {
  const plan = planSnapshotFill({ siteId: SITE, siteData: SITE_DATA, targetsOf });
  assert.deepEqual([...plan.manifest.expectedKeys].sort(), [
    // row 6: the detail context collection
    '/tenant/collectionObjects?limit=100&collectionId=events-col',
    '/tenant/collectionObjects?limit=100&collectionId=filters',
    '/tenant/collectionObjects?limit=100&collectionId=locations',
    // row 2: home and every prerendered single-segment page
    '/tenant/collectionObjects?limit=100&collectionId=menu-col',
    // row 4: the nested page's bindings
    '/tenant/collectionObjects?limit=100&collectionId=specials',
    // row 5: the storefront's supplemental feeds, limit 10, payments excluded
    '/tenant/integrationObjects?limit=10&type=instagram',
    '/tenant/integrationObjects?limit=10&type=tiktok',
    // row 4: LinkedIn is stored camelCase upstream; the key carries that spelling
    '/tenant/integrationObjects?limit=100&type=linkedIn',
    '/tenant/integrationObjects?limit=100&type=tiktok',
    // row 1
    '/tenant/siteDetails?siteId=site-1',
  ].sort());
});

test('T16 REFUSE: off pages, subscribers, non-nestable nested pages, product-bridge reads and storefront collections are not expected', () => {
  const keys = planSnapshotFill({ siteId: SITE, siteData: SITE_DATA, targetsOf }).manifest.expectedKeys.join('\n');
  for (const absent of ['old-col', 'never', 'never-2', 'subs', 'type=stripe', 'collectionId=resale']) {
    assert.ok(!keys.includes(absent), `${absent} must not be expected`);
  }
});

test('T16: the manifest carries the policy the wrapper needs, from the one TypeScript source', () => {
  const { manifest } = planSnapshotFill({ siteId: SITE, siteData: SITE_DATA, targetsOf });
  assert.equal(manifest.siteDetailsKey, '/tenant/siteDetails?siteId=site-1');
  assert.deepEqual(manifest.excludedCollectionIds, ['resale']);
  assert.deepEqual([...manifest.paymentsProviderTypes].sort(), ['square', 'stripe']);
  assert.deepEqual(manifest.forceFloorSiteIds, [...FORCE_FLOOR_SITE_IDS]);
});

test('T16 executor: makes the row 2, 4, 5 and 6 reads through the injected readers and writes the manifest', async () => {
  const calls: string[] = [];
  const manifests: object[] = [];
  await fillSnapshotAtBuild(SITE_DATA, {
    siteId: SITE,
    recorder: { active: true, writeManifest: (m) => manifests.push(m) },
    targetsOf,
    getCollectionItems: async (id, opts) => calls.push(`c:${id}:${opts.limit}`),
    getIntegrationItems: async (type, opts) => calls.push(`i:${type}:${opts.limit}`),
    buildNestedPageContext: async (p) => calls.push(`nested:${p.slug}`),
    log: () => {},
  });
  assert.equal(manifests.length, 1);
  assert.ok(calls.includes('nested:features/ai-sites'));
  assert.ok(calls.includes('i:instagram:10'));
  assert.ok(calls.includes('c:locations:100'));
  assert.ok(calls.includes('c:menu-col:100'));
  assert.ok(!calls.some((c) => c.includes('stripe')), 'no plain read of a payments provider');
});

test('T16 executor: inert when the recorder is not recording (every build but the wrapper\'s)', async () => {
  let reads = 0;
  await fillSnapshotAtBuild(SITE_DATA, {
    siteId: SITE,
    recorder: { active: false, writeManifest: () => { throw new Error('must not write'); } },
    targetsOf,
    getCollectionItems: async () => { reads += 1; },
    getIntegrationItems: async () => { reads += 1; },
    buildNestedPageContext: async () => { reads += 1; },
    log: () => {},
  });
  assert.equal(reads, 0);
});

/* ------------------------------------------- review-3 B1: failed fill reads */

// The real readers RESOLVE on an upstream 5xx: list readers hand back their
// degraded placeholder, a page context reports `listReadFailed`. These fakes
// resolve the same shapes, never reject. SITE_DATA plans 10 fill reads over
// 10 distinct snapshot keys.
const FILL_TASKS = 10;

function fillWith(behaviour: (call: number) => boolean, extra: { targetsOf?: typeof targetsOf } = {}) {
  const lines: string[] = [];
  const manifests: Array<Record<string, unknown>> = [];
  const sleeps: number[] = [];
  let calls = 0;
  const reader = async () => {
    calls += 1;
    return { items: [], degraded: behaviour(calls) };
  };
  return {
    lines,
    manifests,
    sleeps,
    run: () =>
      fillSnapshotAtBuild(SITE_DATA, {
        siteId: SITE,
        recorder: { active: true, writeManifest: (m) => manifests.push(m as Record<string, unknown>) },
        targetsOf: extra.targetsOf ?? targetsOf,
        getCollectionItems: reader,
        getIntegrationItems: reader,
        buildNestedPageContext: async () => {
          calls += 1;
          return { listReadFailed: behaviour(calls) };
        },
        log: (l) => lines.push(l),
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }),
  };
}

test('B1 REFUSE: reads that RESOLVE degraded (a 5xx) are counted failed, retried once, and listed by path and hash', async () => {
  const f = fillWith(() => true);
  await f.run();
  const summary = JSON.parse(f.lines[0]);
  assert.equal(summary.failed, FILL_TASKS, 'still failing after the one retry');
  assert.equal(summary.failedFirstPass, FILL_TASKS);
  assert.deepEqual(f.sleeps, [2_000], 'one pause (2 s) before the retry');
  assert.equal(summary.failedKeys.length, FILL_TASKS);
  for (const k of summary.failedKeys) assert.match(k, /^\/tenant\/(collectionObjects|integrationObjects) [0-9a-f]{12}$/);
  assert.ok(!JSON.stringify(summary).includes('collectionId='), 'no query values in the log');
  const withFailed = f.manifests.find((m) => Array.isArray(m.failedKeys));
  assert.ok(withFailed, 'the failed keys reach the wrapper');
  assert.equal((withFailed.failedKeys as string[]).length, FILL_TASKS);
  assert.ok((withFailed.failedKeys as string[]).includes('/tenant/collectionObjects?limit=100&collectionId=specials'), 'a failed nested page names its keys');
});

test('B1 ALLOW: reads that resolve healthy count 0 failed, with no retry and no failed-keys shard', async () => {
  const f = fillWith(() => false);
  await f.run();
  const summary = JSON.parse(f.lines[0]);
  assert.equal(summary.failed, 0);
  assert.equal(summary.failedFirstPass, 0);
  assert.deepEqual(f.sleeps, []);
  assert.equal(f.manifests.length, 1);
});

test('B1: a read that fails once and succeeds on its retry is not counted failed', async () => {
  const f = fillWith((call) => call <= FILL_TASKS);
  await f.run();
  const summary = JSON.parse(f.lines[0]);
  assert.equal(summary.failed, 0);
  assert.equal(summary.failedFirstPass, FILL_TASKS);
  assert.equal(f.manifests.length, 1);
});

test('B1: a reader that throws still counts, and the pass still resolves', async () => {
  const lines: string[] = [];
  await fillSnapshotAtBuild(SITE_DATA, {
    siteId: SITE,
    recorder: { active: true, writeManifest: () => {} },
    targetsOf,
    getCollectionItems: async () => { throw new Error('upstream down'); },
    getIntegrationItems: async () => { throw new Error('upstream down'); },
    buildNestedPageContext: async () => { throw new Error('upstream down'); },
    log: (l) => lines.push(l),
    sleep: async () => {},
  });
  assert.equal(JSON.parse(lines[0]).failed, FILL_TASKS);
});

/* ------------------------------------------- review-3 B2: a planner fault */

test('B2 REFUSE: a planner fault (a malformed page config) writes a shell-only manifest with fillError, and resolves', async () => {
  const f = fillWith(() => false, {
    targetsOf: (p) => {
      if (p.slug === 'events') throw new TypeError("Cannot read properties of undefined (reading 'bindings')");
      return targetsOf(p);
    },
  });
  await f.run();
  assert.equal(f.manifests.length, 1);
  assert.deepEqual(f.manifests[0].expectedKeys, ['/tenant/siteDetails?siteId=site-1']);
  assert.equal(f.manifests[0].siteDetailsKey, '/tenant/siteDetails?siteId=site-1');
  assert.equal(f.manifests[0].fillError, true);
  assert.equal(JSON.parse(f.lines[0]).fillError, true);
});

test('B2 ALLOW: a plan that succeeds carries no fillError', async () => {
  const f = fillWith(() => false);
  await f.run();
  assert.equal(f.manifests[0].fillError, undefined);
});

test('usesProductBridge: payments types and every integration on a products page go through the bridge', () => {
  assert.equal(usesProductBridge('stripe', 'static'), true);
  assert.equal(usesProductBridge('instagram', 'products'), true);
  assert.equal(usesProductBridge('instagram', 'static'), false);
});

/* ------------------------------------------------------------ T14, the ids */

test('T14 ALLOW: the resale shop (a products page bound to a collection) excludes that collection', () => {
  assert.deepEqual(storefrontCollectionIds(PAGES, (p) => targetsOf(p).integrationTypes), ['resale']);
});

test('T14 REFUSE: a collection-list page that sells nothing is not a storefront, its collection stays floorable', () => {
  const blog = page({ slug: 'blog', format: 'collection-list', detailPage: { itemCollectionId: 'posts' } });
  assert.deepEqual(storefrontCollectionIds([blog], () => []), []);
});

test('T14: a page bound to a payments provider that serves collection detail is a storefront too', () => {
  const catalog = page({ slug: 'catalog', format: 'catalog', detailPage: { itemCollectionId: 'goods' } });
  assert.deepEqual(storefrontCollectionIds([catalog], () => ['square']), ['goods']);
});

test('the fill pass never has more than FILL_CONCURRENCY reads in flight (Phase 0a: an unbounded burst drew 503s)', async () => {
  let inFlight = 0;
  let peak = 0;
  const slow = async () => {
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight -= 1;
  };
  const many = { ...SITE_DATA, homePageConfig: HOME };
  await fillSnapshotAtBuild(many, {
    siteId: SITE,
    recorder: { active: true, writeManifest: () => {} },
    targetsOf: () => ({ collectionIds: Array.from({ length: 20 }, (_, i) => `c${i}`), integrationTypes: [] }),
    getCollectionItems: slow,
    getIntegrationItems: slow,
    buildNestedPageContext: slow,
    log: () => {},
  });
  assert.equal(peak, FILL_CONCURRENCY);
});
