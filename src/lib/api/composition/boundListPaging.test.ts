import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { register as registerLoader } from 'node:module';

/**
 * SW-13 (hotfix 2026-11-13, vivreal-hq hotfix plan T-1, F257): a page reads
 * every page of a bound collection through `readAllPages`, 100 a read, up to
 * `PAGE_LIST_MAX_ITEMS` (1,000), and the build-time floor stores every page.
 *
 * Before this, the page context and its floor read one window of 100. Live on
 * 2026-11-13 (research-hotfix-r1-r4.md, R-2): the help site's article list
 * holds 101 items and `/all-articles` listed 100, missing "Your menu and
 * footer". The same list (and a 602-row one bound on about a hundred nested
 * article pages) is the only bound list over 100 in the fleet (read-only
 * count, 50 sites, 2026-11-13).
 *
 * Everything here is REAL except the Client API read itself
 * (`./testSupport/pageContextLoader.mjs`): `buildPageContext`, the binding
 * collector, `getCollectionItems`, `readAllPages`, the fill pass, the seam
 * that records a build's reads, the recorder (writing to a temp directory)
 * and the build wrapper's own merge (`scripts/build-with-snapshot.mjs`). The
 * fake Client API answers what `doClientFetch` hands back after unwrapping
 * VR_Client_API's `{ success, data }` envelope (`clientFetchCore.ts`): the
 * `{ items, totalCount, richTextImageUrls }` page of the exact request path
 * the real reader built, at most 100 rows a read, from `skip`, like
 * `getCollectionObjects.js` (`limit` clamped to 100). A failed read throws,
 * as `doClientFetch` does.
 *
 * Red at d4d67593 (the base, these test files only): the 101 rows reach
 * neither the page context nor the floor (100), the failed second page is
 * named nowhere, and 1,001 rows log no `list.truncated`.
 */

registerLoader(new URL('./testSupport/pageContextLoader.mjs', import.meta.url).href);

const { configureClientStub } = await import('./testSupport/clientStub.mjs');
const { buildPageContext } = await import('./buildPageContext.ts');
const { collectBindingTargets } = await import('./bindings.ts');
const { getCollectionItems, getIntegrationItems } = await import('../collections/index.ts');
const fill = await import('../snapshot/fill.ts');
const { createSnapshotRecorder } = await import('../snapshot/recorder.ts');
const { readRecords, mergeManifests } = await import('../../../../scripts/build-with-snapshot.mjs');

const SITE = '6aa1b1a896bf3f53d9beeaea';
/** "Help Articles", bound on the help site's hub pages and `/all-articles`. */
const ARTICLES = '6aa1b0f72eff6a5227e493b1';
/** The 602-row list each nested help article binds as its "On this page" contents. */
const ARTICLE_SECTIONS = '6aa1b0fb2eff6a5227e493bf';

// The help site's `/all-articles` page as stored (pod_01.sites, read
// 2026-11-13): a `collection-list` page whose page-template block binds the
// list as an A to Z index. Cast: the stored page carries more than the type.
const ALL_ARTICLES = {
  slug: 'all-articles',
  name: 'All articles',
  format: 'collection-list',
  collections: [
    {
      collectionId: ARTICLES,
      role: 'primary',
      displayAs: 'alpha-index',
      sectionConfig: { groupBy: 'initial', suppressEmptyBuckets: true, detailEligible: false },
      order: 0,
    },
  ],
  blocks: [
    { id: 'blk_all_articles_hero', type: { kind: 'home-section', dispatchId: 'hero' }, order: -1, enabled: true },
    {
      id: 'blk_all_articles_pagetemplate_0',
      type: { kind: 'page-template', dispatchId: 'collection' },
      order: 0,
      enabled: true,
      config: {
        bindings: [
          {
            collectionId: ARTICLES,
            displayAs: 'alpha-index',
            sectionConfig: { groupBy: 'initial', suppressEmptyBuckets: true, detailEligible: false, showHeader: false },
            role: 'primary',
          },
        ],
      },
    },
  ],
} as unknown as Parameters<typeof buildPageContext>[0]['page'];

// A nested help article (`connections/facebook`, same read): its contents
// list is the 602-row list, scoped to the article. Served by the detail
// route, so the fill pass reads it (row 4), not a prerender.
const FACEBOOK_ARTICLE = {
  slug: 'connections/facebook',
  name: 'Facebook',
  format: 'standard',
  blocks: [
    {
      id: 'blk_facebook_pagetemplate_0',
      type: { kind: 'page-template', dispatchId: 'collection' },
      order: 0,
      enabled: true,
      config: {
        bindings: [
          {
            collectionId: ARTICLE_SECTIONS,
            displayAs: 'article-toc',
            sectionConfig: {
              scope: { field: 'article', value: ['connections-facebook'] },
              dock: 'left',
              eyebrow: 'On this page',
              detailEligible: false,
            },
            role: 'primary',
          },
        ],
      },
    },
  ],
} as unknown as Parameters<typeof buildPageContext>[0]['page'];

/** The key a list's first read has always had; a list of 100 or fewer is read under it alone. */
const oneReadKey = (id: string) => `/tenant/collectionObjects?limit=100&collectionId=${id}`;
const pageKey = (id: string, skip: number) => `/tenant/collectionObjects?limit=100&skip=${skip}&collectionId=${id}`;

/**
 * A fake VR_Client_API holding `rows[collectionId]` items in each list. Every
 * request path is recorded. `failAt` lists `skip` values whose read fails.
 */
function clientApi(rows: Record<string, number>, { failAt = [] as number[] } = {}) {
  const requests: string[] = [];
  const api = (requestPath: string) => {
    requests.push(requestPath);
    const [route, query] = requestPath.split('?');
    assert.equal(route, '/tenant/collectionObjects', `only collection reads are expected, got ${requestPath}`);
    const params = new URLSearchParams(query);
    const id = params.get('collectionId') ?? '';
    const skip = Number(params.get('skip') ?? 0);
    const limit = Math.min(Number(params.get('limit') ?? 20), 100);
    if (failAt.includes(skip)) throw new Error(`503 from the fake Client API at skip ${skip}`);
    const total = rows[id] ?? 0;
    const items = Array.from({ length: Math.max(0, Math.min(limit, total - skip)) }, (_, i) => ({
      _id: `${id}-row-${skip + i + 1}`,
      objectValue: { title: `Article ${skip + i + 1}`, article: 'connections-facebook' },
    }));
    return { items, totalCount: total, richTextImageUrls: {} };
  };
  return { requests, api };
}

async function pageContextFor(page: typeof ALL_ARTICLES) {
  return buildPageContext({ siteData: { pageConfigs: [page] } as never, page, isHome: false });
}

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bound-list-floor-'));
}

/**
 * One build's fill pass over the help site's two page shapes, recorded by
 * the real recorder, then merged by the wrapper's own `readRecords` and
 * `mergeManifests`. `uncovered` is the wrapper's count
 * (`build-with-snapshot.mjs:407-410`), list keys only (no shell read here).
 */
async function floorFor(rows: Record<string, number>, opts: { failAt?: number[] } = {}) {
  const dir = tempDir();
  const lines: string[] = [];
  const upstream = clientApi(rows, opts);
  const recorder = createSnapshotRecorder({ dir, siteId: SITE });
  configureClientStub({ api: upstream.api, recorder });
  const siteData = { pageConfigs: [ALL_ARTICLES, FACEBOOK_ARTICLE], homePageConfig: null } as never;
  try {
    await fill.fillSnapshotAtBuild(siteData, {
      siteId: SITE,
      recorder,
      targetsOf: collectBindingTargets,
      getCollectionItems,
      getIntegrationItems,
      buildNestedPageContext: (page) => buildPageContext({ siteData, page, isHome: false }),
      log: (line) => lines.push(line),
      sleep: async () => {},
    });
    const { entries, manifests } = readRecords(dir);
    const manifest = mergeManifests(manifests, SITE);
    const uncovered = manifest.expectedKeys.filter((k: string) => !entries.has(k));
    for (const k of manifest.failedKeys) if (!entries.has(k) && !uncovered.includes(k)) uncovered.push(k);
    return {
      entries: entries as Map<string, { items: unknown[] }>,
      uncovered: uncovered.filter((k: string) => k.startsWith('/tenant/collectionObjects')),
      failedKeys: manifest.failedKeys as string[],
      lines,
      requests: upstream.requests,
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Rows the floor holds for `id`, over every page key it recorded. */
function flooredRows(entries: Map<string, { items: unknown[] }>, id: string): number {
  let rows = 0;
  for (const [key, value] of entries) {
    if (new URLSearchParams(key.split('?')[1]).get('collectionId') === id) rows += value.items.length;
  }
  return rows;
}

test('ALLOW (red at d4d67593): the help list\'s 101 rows all reach the page context, in two reads', async () => {
  const upstream = clientApi({ [ARTICLES]: 101 });
  configureClientStub({ api: upstream.api });
  const context = await pageContextFor(ALL_ARTICLES);
  const items = context.input.data.getItems(ARTICLES);
  assert.equal(items.length, 101, 'every article reaches the page');
  assert.equal(items[100].id, `${ARTICLES}-row-101`, 'the 101st article ("Your menu and footer" live) is on the page');
  assert.deepEqual(upstream.requests, [oneReadKey(ARTICLES), pageKey(ARTICLES, 100)]);
  assert.equal(context.listReadFailed, false);
  assert.equal(context.isEmpty, false);
});

test('ALLOW: a list of 100 or fewer is exactly ONE Client read, under the key it always had', async () => {
  for (const total of [0, 1, 46, 99, 100]) {
    const upstream = clientApi({ [ARTICLES]: total });
    configureClientStub({ api: upstream.api });
    const context = await pageContextFor(ALL_ARTICLES);
    assert.deepEqual(upstream.requests, [oneReadKey(ARTICLES)], `${total} rows: one read, no extra cost`);
    assert.equal(context.input.data.getItems(ARTICLES).length, total);
  }
});

test('ALLOW (red at d4d67593): the floor stores every page, in the help list\'s shape, with nothing uncovered', async () => {
  const floor = await floorFor({ [ARTICLES]: 101, [ARTICLE_SECTIONS]: 602 });
  assert.equal(floor.entries.get(oneReadKey(ARTICLES))?.items.length, 100, 'the first page, under the key it always had');
  assert.equal(floor.entries.get(pageKey(ARTICLES, 100))?.items.length, 1, 'the second page');
  assert.equal(flooredRows(floor.entries, ARTICLES), 101);
  // The nested article's contents list: seven pages, 602 rows.
  assert.equal(flooredRows(floor.entries, ARTICLE_SECTIONS), 602);
  assert.ok(floor.entries.has(pageKey(ARTICLE_SECTIONS, 600)));
  assert.deepEqual(floor.uncovered, []);
  assert.deepEqual(floor.failedKeys, []);
});

test('REFUSE (red at d4d67593): a second page that fails at build is a counted hole, never a silent one', async () => {
  const floor = await floorFor({ [ARTICLES]: 101, [ARTICLE_SECTIONS]: 60 }, { failAt: [100] });
  assert.ok(!floor.entries.has(pageKey(ARTICLES, 100)), 'the failed page is not in the floor');
  assert.ok(floor.failedKeys.includes(pageKey(ARTICLES, 100)), 'the wrapper is told which page failed');
  assert.deepEqual(floor.uncovered, [pageKey(ARTICLES, 100)], 'and counts it uncovered, so the rollout gate sees it');
  const summary = JSON.parse(floor.lines.find((l) => l.includes('"site.snapshot.fill"')) ?? '{}');
  assert.ok(summary.failed >= 1, 'the fill line reports the failed read');
});

test('REFUSE (red at d4d67593): 1,001 rows read 1,000 in ten reads, answer truncated: true and log list.truncated', async (t) => {
  const warned: string[] = [];
  t.mock.method(console, 'warn', (line: string) => warned.push(String(line)));
  const upstream = clientApi({ [ARTICLES]: 1_001 });
  configureClientStub({ api: upstream.api });
  const context = await pageContextFor(ALL_ARTICLES);

  const truncatedLines = warned.filter((l) => l.includes('"list.truncated"'));
  assert.equal(truncatedLines.length, 1, 'the page says it stopped short, never silently');
  const line = JSON.parse(truncatedLines[0]);
  assert.deepEqual(
    { event: line.event, path: line.path, totalCount: line.totalCount, items: line.items, maxItems: line.maxItems },
    { event: 'list.truncated', path: '/tenant/collectionObjects', totalCount: 1_001, items: 1_000, maxItems: 1_000 },
  );
  assert.match(line.key, /^[0-9a-f]{12}$/);
  assert.ok(!truncatedLines[0].includes(ARTICLES), 'no collection id in the log line');
  assert.equal(context.input.data.getItems(ARTICLES).length, 1_000);
  assert.equal(upstream.requests.length, 10, 'bounded: at most ten reads');

  // The reader's own answer says so too.
  const again = clientApi({ [ARTICLES]: 1_001 });
  configureClientStub({ api: again.api });
  const read = await fill.readCollectionPageList(ARTICLES, getCollectionItems, () => {});
  assert.equal(read.truncated, true);
  assert.equal(read.totalCount, 1_001);
  assert.equal(read.items.length, fill.PAGE_LIST_MAX_ITEMS);
});

test('ALLOW: a list that ends exactly at the ceiling is whole, not truncated', async () => {
  const upstream = clientApi({ [ARTICLES]: 1_000 });
  configureClientStub({ api: upstream.api });
  const lines: string[] = [];
  const read = await fill.readCollectionPageList(ARTICLES, getCollectionItems, (l) => lines.push(l));
  assert.equal(read.truncated, false);
  assert.equal(read.items.length, 1_000);
  assert.deepEqual(lines, []);
});
