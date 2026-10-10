import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sitemapDetailSource } from './sitemapDetailSources.ts';

const cards = (collectionId: string) => ({
  id: 'b',
  type: { kind: 'layout', dispatchId: 'cards' },
  config: { bindings: [{ collectionId }] },
});
// Cast: a fixture carries only the fields the rule reads.
const page = (p: Record<string, unknown>) => p as unknown as Parameters<typeof sitemapDetailSource>[0];

test('ALLOW (R4): a catalog page lists its bound collection by default, no opt-in needed', () => {
  assert.deepEqual(sitemapDetailSource(page({ format: 'catalog', blocks: [cards('c1')] }), { paymentsProvider: undefined, pages: [] }), {
    kind: 'collection',
    collectionId: 'c1',
  });
});

test('ALLOW (R4): a products page lists the provider products the detail route reads, plus its collection when it serves one', () => {
  assert.deepEqual(sitemapDetailSource(page({ format: 'products', blocks: [] }), { paymentsProvider: 'square', pages: [] }), {
    kind: 'products',
    provider: 'square',
    collection: null,
  });
  assert.deepEqual(
    sitemapDetailSource(page({ format: 'products', blocks: [], detailPage: { itemCollectionId: 'c9', itemKeyField: 'slug' } }), {
      paymentsProvider: undefined, pages: [],
    }),
    { kind: 'products', provider: 'stripe', collection: { kind: 'collection', collectionId: 'c9', itemKeyField: 'slug' } },
  );
});

test('ALLOW (R4): events and team pages list through their own arms', () => {
  assert.deepEqual(sitemapDetailSource(page({ format: 'shows', blocks: [cards('ev')] }), { paymentsProvider: undefined, pages: [] }), {
    kind: 'shows',
    collectionId: 'ev',
  });
  assert.equal(sitemapDetailSource(page({ format: 'team' }), { paymentsProvider: undefined, pages: [] })?.kind, 'team');
});

test('REFUSE (R4): the owner opt-out and a switched-off detail route list nothing', () => {
  for (const detailPage of [{ sitemap: false }, { enabled: false }]) {
    assert.equal(sitemapDetailSource(page({ format: 'catalog', blocks: [cards('c1')], detailPage }), { paymentsProvider: undefined, pages: [] }), null);
    assert.equal(sitemapDetailSource(page({ format: 'products', detailPage }), { paymentsProvider: 'stripe', pages: [] }), null);
  }
});

test('REFUSE (R4): a page with no detail route lists nothing, and a menu is listed only when it opted in', () => {
  assert.equal(sitemapDetailSource(page({ format: 'standard', blocks: [cards('c1')] }), { paymentsProvider: undefined, pages: [] }), null);
  assert.equal(sitemapDetailSource(page({ format: 'menu', blocks: [cards('c1')] }), { paymentsProvider: undefined, pages: [] }), null);
  assert.deepEqual(
    sitemapDetailSource(page({ format: 'menu', detailPage: { sitemap: true, itemCollectionId: 'm1' } }), { paymentsProvider: undefined, pages: [] }),
    { kind: 'collection', collectionId: 'm1' },
  );
});

// B1 (review of #190): only the items the site links. Shapes read from
// help.vivreal.io's siteDetails on 2026-10-10.
const ARTICLES = 'articles';
const categoryPage = (slug: string, sectionConfig: Record<string, unknown>) => ({
  slug,
  format: 'collection-list',
  blocks: [{ id: slug, type: { kind: 'page-template', dispatchId: 'collection' }, config: { bindings: [{ collectionId: ARTICLES, sectionConfig }] } }],
});
const sectionScope = (value: string) => ({ field: 'section', value: [value] });
const linkCards = (collectionId: string, sectionConfig: Record<string, unknown>) => ({
  id: 'lc',
  type: { kind: 'layout', dispatchId: 'link-cards' },
  config: { bindings: [{ collectionId, sectionConfig }] },
});

test('REFUSE (B1): a list that opts out with detailEligible:false lists nothing', () => {
  const p = categoryPage('all-articles', { detailEligible: false });
  assert.equal(sitemapDetailSource(page(p), { paymentsProvider: undefined, pages: [p] }), null);
});

test('REFUSE (B1): a scoped, eligible section lists only its own scope', () => {
  const p = categoryPage('connections', { scope: sectionScope('connections') });
  assert.deepEqual(sitemapDetailSource(page(p), { paymentsProvider: undefined, pages: [p] }), {
    kind: 'collection',
    collectionId: ARTICLES,
    linkScopes: [sectionScope('connections')],
  });
});

test('ALLOW (B1): an eligible, unscoped list lists every item (no linkScopes, as before)', () => {
  const p = categoryPage('blog', {});
  assert.deepEqual(sitemapDetailSource(page(p), { paymentsProvider: undefined, pages: [p] }), {
    kind: 'collection',
    collectionId: ARTICLES,
  });
});

test('ALLOW (B1): an opted-out owner still lists what a widget elsewhere links into it', () => {
  const owner = categoryPage('getting-started', { detailEligible: false });
  const home = { slug: 'home', format: 'about', blocks: [linkCards(ARTICLES, { scope: sectionScope('getting-started') })] };
  assert.deepEqual(sitemapDetailSource(page(owner), { paymentsProvider: undefined, pages: [home, owner] }), {
    kind: 'collection',
    collectionId: ARTICLES,
    linkScopes: [sectionScope('getting-started')],
  });
});

test('B1: a site shaped like help.vivreal.io lists no category item addresses (586 back to 74)', () => {
  const sections = ['getting-started', 'your-website', 'your-content', 'connections', 'selling-online', 'your-account', 'troubleshooting'];
  const categories = [
    ...sections.map((s) => categoryPage(s, { scope: sectionScope(s), detailEligible: false })),
    categoryPage('all-articles', { detailEligible: false }),
  ];
  const home = {
    slug: 'home',
    format: 'about',
    blocks: [linkCards('sections', { detailEligible: false }), linkCards(ARTICLES, { detailEligible: false, scope: sectionScope('getting-started') })],
  };
  const articles = Array.from({ length: 64 }, (_, i) => ({ slug: `connections/article-${i}`, format: 'standard', blocks: [] }));
  const pages = [home, ...categories, { slug: 'contact', format: 'form', blocks: [linkCards('form', {})] }, { slug: 'lookup', format: 'lookup', blocks: [] }, ...articles];
  assert.equal(pages.length, 75);
  const sources = pages.map((p) => sitemapDetailSource(page(p), { paymentsProvider: undefined, pages }));
  assert.equal(sources.filter(Boolean).length, 0);
});
