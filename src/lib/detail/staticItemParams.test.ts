/**
 * Owner ideas 2026-10-29, T11 (plan 3.8): which item addresses prerender.
 * The runtime half (no `dynamicRoutes` fallback in the prerender manifest, a
 * listed item HITs, an unlisted one is 200 `no-store`, never 500) is
 * scripts/isr-build-check.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// The renderer's own link helper, by path (its root entry imports next/link).
import { itemSegment } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemSegment.js';
import {
  DETAIL_SENTINEL,
  PER_PAGE_LIMIT,
  TOTAL_LIMIT,
  isDetailSentinel,
  listStaticItemParams,
  type ListedPage,
  type ListedItem,
} from './staticItemParams.ts';

type Page = ListedPage & { collection?: string };

const ITEMS: Record<string, ListedItem[]> = {
  posts: [
    { id: '6a0000000000000000000001', raw: { slug: 'first-loaf' } },
    { id: '6a0000000000000000000002', raw: {} },
  ],
};

function deps(serving = new Set(['blog'])) {
  const reads: string[] = [];
  return {
    reads,
    deps: {
      servesCollectionDetail: (p: Page) => serving.has(p.slug ?? ''),
      isPageTurnedOff: (p: Page) => p.enabled === false,
      collectionIdOf: (p: Page) => p.collection,
      readItems: async (id: string) => {
        reads.push(id);
        if (id === 'broken') throw new Error('read failed');
        return ITEMS[id] ?? Array.from({ length: 150 }, (_, i) => ({ id: `${id}-${i}`, raw: {} }));
      },
      segmentOf: (item: ListedItem, key: string | undefined) => itemSegment(item, key),
    },
  };
}

test('ALLOW: a collection page lists its items at the address a visitor sees', async () => {
  const pages: Page[] = [{ slug: 'blog', collection: 'posts', detailPage: { itemKeyField: 'slug' } }];
  const { deps: d } = deps();
  assert.deepEqual(await listStaticItemParams(pages, d), [
    { slug: 'blog', itemId: 'first-loaf' },
    { slug: 'blog', itemId: '6a0000000000000000000002' },
  ], 'the key field when set, the id otherwise, exactly like the list links');
});

test('REFUSE: pages that do not serve collection detail, turned off, detail off or nested list nothing', async () => {
  const pages: Page[] = [
    { slug: 'about', collection: 'posts' },
    { slug: 'blog', collection: 'posts', enabled: false },
    { slug: 'news', collection: 'posts', detailPage: { enabled: false } },
    { slug: 'features/ai', collection: 'posts' },
  ];
  const serving = new Set(['blog', 'news', 'features/ai']);
  const { deps: d, reads } = deps(serving);
  assert.deepEqual(await listStaticItemParams(pages, d), []);
  assert.deepEqual(reads, [], 'and reads nothing for them');
});

test('REFUSE: a failed read lists nothing for that page and never throws', async () => {
  const { deps: d } = deps(new Set(['a', 'blog']));
  const out = await listStaticItemParams([{ slug: 'a', collection: 'broken' }, { slug: 'blog', collection: 'posts' }] as Page[], d);
  assert.equal(out.length, 2, 'the next page still lists');
});

test('REFUSE: the list is capped per page and in total', async () => {
  const pages: Page[] = Array.from({ length: 5 }, (_, i) => ({ slug: `c${i}`, collection: `big${i}` }));
  const { deps: d } = deps(new Set(pages.map((p) => p.slug ?? '')));
  const out = await listStaticItemParams(pages, d);
  assert.equal(out.length, TOTAL_LIMIT);
  assert.equal(out.filter((p) => p.slug === 'c0').length, PER_PAGE_LIMIT);
});

test('REFUSE: a segment the router would not hand back unchanged is not listed', async () => {
  const { deps: d } = deps();
  const out = await listStaticItemParams([{ slug: 'blog', collection: 'odd', detailPage: { itemKeyField: 'slug' } }] as Page[], {
    ...d,
    readItems: async () => [{ id: 'a1', raw: { slug: 'has space' } }, { id: 'a2', raw: { slug: '../up' } }, { id: 'a3', raw: { slug: 'ok-one' } }],
  });
  assert.deepEqual(out, [{ slug: 'blog', itemId: 'ok-one' }]);
});

test('the sentinel is never a real page and the route bails on it before any read', () => {
  assert.equal(isDetailSentinel(DETAIL_SENTINEL, DETAIL_SENTINEL), true);
  assert.equal(isDetailSentinel(DETAIL_SENTINEL, 'x'), false);
  assert.ok(DETAIL_SENTINEL.startsWith('_'), 'reserved by the underscore rule');
  const source = fs.readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /return \[\.\.\.items, \{ \.\.\.DETAIL_SENTINEL_PARAMS \}\];/, 'always appended');
  const render = source.slice(source.indexOf('export default async function DynamicItemPage'));
  const sentinel = render.indexOf('if (isDetailSentinel(slug, itemId)) {\n    await connection();\n    return notFound();');
  assert.ok(sentinel > 0, 'connection() before notFound()');
  assert.ok(sentinel < render.indexOf('await getSiteData()'), 'before any read');
});

test('REFUSE: the nested page arm reads searchParams only behind pageReadsQuery', () => {
  const source = fs.readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const sp = pageReadsQuery\(nestedPage\) \? \(\(await searchParams\) \?\? \{\}\) : \{\};/);
  // The two redirect reads stay (show and team id addresses), safe only because
  // of the sentinel above.
  assert.equal((source.match(/readableRedirectTarget\(slug, [a-zA-Z.]+, \(await searchParams\) \?\? \{\}\)/g) ?? []).length, 2);
});
