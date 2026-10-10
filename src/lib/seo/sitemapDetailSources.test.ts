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
  assert.deepEqual(sitemapDetailSource(page({ format: 'catalog', blocks: [cards('c1')] }), { paymentsProvider: undefined }), {
    kind: 'collection',
    collectionId: 'c1',
  });
});

test('ALLOW (R4): a products page lists the provider products the detail route reads, plus its collection when it serves one', () => {
  assert.deepEqual(sitemapDetailSource(page({ format: 'products', blocks: [] }), { paymentsProvider: 'square' }), {
    kind: 'products',
    provider: 'square',
    collection: null,
  });
  assert.deepEqual(
    sitemapDetailSource(page({ format: 'products', blocks: [], detailPage: { itemCollectionId: 'c9', itemKeyField: 'slug' } }), {
      paymentsProvider: undefined,
    }),
    { kind: 'products', provider: 'stripe', collection: { kind: 'collection', collectionId: 'c9', itemKeyField: 'slug' } },
  );
});

test('ALLOW (R4): events and team pages list through their own arms', () => {
  assert.deepEqual(sitemapDetailSource(page({ format: 'shows', blocks: [cards('ev')] }), { paymentsProvider: undefined }), {
    kind: 'shows',
    collectionId: 'ev',
  });
  assert.equal(sitemapDetailSource(page({ format: 'team' }), { paymentsProvider: undefined })?.kind, 'team');
});

test('REFUSE (R4): the owner opt-out and a switched-off detail route list nothing', () => {
  for (const detailPage of [{ sitemap: false }, { enabled: false }]) {
    assert.equal(sitemapDetailSource(page({ format: 'catalog', blocks: [cards('c1')], detailPage }), { paymentsProvider: undefined }), null);
    assert.equal(sitemapDetailSource(page({ format: 'products', detailPage }), { paymentsProvider: 'stripe' }), null);
  }
});

test('REFUSE (R4): a page with no detail route lists nothing, and a menu is listed only when it opted in', () => {
  assert.equal(sitemapDetailSource(page({ format: 'standard', blocks: [cards('c1')] }), { paymentsProvider: undefined }), null);
  assert.equal(sitemapDetailSource(page({ format: 'menu', blocks: [cards('c1')] }), { paymentsProvider: undefined }), null);
  assert.deepEqual(
    sitemapDetailSource(page({ format: 'menu', detailPage: { sitemap: true, itemCollectionId: 'm1' } }), { paymentsProvider: undefined }),
    { kind: 'collection', collectionId: 'm1' },
  );
});
