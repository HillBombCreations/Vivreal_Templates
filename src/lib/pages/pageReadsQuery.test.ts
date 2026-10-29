/**
 * Owner ideas 2026-10-29, T10 (plan 3.8): inner pages read the address query
 * only when they can use it, so a page with no storefront caches like the
 * home page. The runtime half (the prerender manifest, `x-nextjs-cache`) is
 * scripts/isr-build-check.mjs; this pins the decision and that the route
 * reaches it at every read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pageReadsQuery } from './pageReadsQuery.ts';
import { CHECKOUT_RESULT_SLUGS } from './builtInPages.ts';
import { purgesWholeSite, tagsForEvent } from '../revalidateTags.ts';

const block = (dispatchId: string, extra: Record<string, unknown> = {}) => ({ type: { kind: 'page-template', dispatchId }, config: {}, ...extra });
const ABOUT = { slug: 'about', format: 'about', blocks: [block('section-header'), block('about')] };
const LINKS = { slug: 'links', format: 'links', blocks: [block('link-profile'), block('link-stack')] };
const BLOG = { slug: 'blog', format: 'collection-list', blocks: [block('collection', { config: { bindings: [{ collectionId: 'c1' }] } })] };

test('ALLOW: a composed page with no storefront, lookup or schedule does not read the query', () => {
  assert.equal(pageReadsQuery(ABOUT), false);
  assert.equal(pageReadsQuery(LINKS), false);
  assert.equal(pageReadsQuery(BLOG), false);
});

test('REFUSE: a storefront anywhere keeps the page reading the query, switched on or off', () => {
  assert.equal(pageReadsQuery({ slug: 'shop', format: 'catalog', blocks: [block('products')] }), true);
  const group = { type: { kind: 'group' }, config: { coordinated: 'products', children: [block('products-toolbar'), block('products-grid')] } };
  assert.equal(pageReadsQuery({ slug: 'menu', format: 'standard', blocks: [block('hero'), group] }), true);
  const nested = { type: { kind: 'group' }, config: { children: [{ type: { kind: 'group' }, config: { children: [block('products-grid')] } }] } };
  assert.equal(pageReadsQuery({ slug: 'deep', format: 'standard', blocks: [nested] }), true);
  assert.equal(pageReadsQuery({ slug: 'off', format: 'standard', blocks: [{ ...block('products'), enabled: false }] }), true);
  // The coordination flag alone says storefront, whatever children are stored yet.
  assert.equal(pageReadsQuery({ slug: 'g', format: 'standard', blocks: [{ type: { kind: 'group' }, config: { coordinated: 'products' } }] }), true);
});

test('REFUSE: checkout result slugs, lookup, schedule, products and legacy block-less pages read it', () => {
  for (const slug of CHECKOUT_RESULT_SLUGS) assert.equal(pageReadsQuery({ slug, format: 'standard', blocks: [block('x')] }), true, slug);
  for (const format of ['lookup', 'schedule', 'products', 'checkout-success', 'checkout-cancel']) {
    assert.equal(pageReadsQuery({ slug: 'p', format, blocks: [block('x')] }), true, format);
  }
  assert.equal(pageReadsQuery({ slug: 'old', format: 'standard' }), true, 'no blocks: cannot be ruled out');
  assert.equal(pageReadsQuery({ slug: 'old', format: 'standard', blocks: [] }), true);
  assert.equal(pageReadsQuery(undefined), true);
});

test('REFUSE: the route never awaits searchParams except behind pageReadsQuery', () => {
  const source = fs.readFileSync(new URL('../../app/[slug]/page.tsx', import.meta.url), 'utf8');
  const reads = source.match(/await searchParams/g) ?? [];
  // Review B2: each read is also behind mayReadQuery (src/lib/queryReadGate.ts).
  const gated = source.match(/pageReadsQuery\((composedPage|pageConfig)\) && mayReadQuery\(\) \? \(\(await searchParams\) \?\? \{\}\) : \{\}/g) ?? [];
  assert.equal(reads.length, 3, 'the generic arm, the format arm, and metadata');
  assert.equal(gated.length, reads.length, 'every read is gated');
  assert.ok(!/"render \(then cache\) on first request|render \(then\s*\/\/ cache\) on first request/.test(source), 'the wrong docblock line is gone');
});

test('ALLOW: a per-page save (Secure S16, site.updated with a slug) drops the tag every page read carries', () => {
  assert.deepEqual(tagsForEvent('site.updated', { siteId: 's1', slug: 'pricing', changedFields: ['labels'] }, 'site123'), ['site:site123']);
  const siteData = fs.readFileSync(new URL('../api/siteData/index.tsx', import.meta.url), 'utf8');
  assert.match(siteData, /const SITE_CHROME_TAG = SITE_ID \? \[`site:\$\{SITE_ID\}`\] : undefined;/, 'getSiteData tags its read site:<id>');
  const route = fs.readFileSync(new URL('../../app/api/revalidate/route.ts', import.meta.url), 'utf8');
  assert.match(route, /tagsForEvent\(event, body\.data, SITE_ID\)/);
});

test('ALLOW: an event that drops a tag also purges every page by path; REFUSE: one that drops nothing purges nothing', () => {
  assert.equal(purgesWholeSite(tagsForEvent('site.updated', { slug: 'about' }, 'site123')), true);
  assert.equal(purgesWholeSite(tagsForEvent('content.updated', { collectionObj: { refID: 'c1' } }, 'site123')), true);
  assert.equal(purgesWholeSite(tagsForEvent('order.created', {}, 'site123')), false);
  const route = fs.readFileSync(new URL('../../app/api/revalidate/route.ts', import.meta.url), 'utf8');
  assert.match(route, /if \(purgesWholeSite\(tags\)\) revalidatePath\("\/", "layout"\);/);
  assert.ok(route.indexOf('revalidatePath("/", "layout")') > route.indexOf('safeEqualHex(provided, expected)'), 'only after the signature check');
});

test('REFUSE: an unsigned-shape or unknown event drops nothing; no site id, no site tag', () => {
  assert.deepEqual(tagsForEvent('order.created', {}, 'site123'), []);
  assert.deepEqual(tagsForEvent('site.updated', {}, ''), []);
  assert.deepEqual(tagsForEvent('content.updated', { collectionObj: { refID: 'c1' } }, 'site123'), ['collection:c1']);
});
