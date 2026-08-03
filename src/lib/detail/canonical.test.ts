import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDetailCanonical } from './canonical.ts';

const item = { id: 'i1', raw: { slug: 'botox' } };

test('resolveDetailCanonical: absent canonicalFrom ⇒ undefined (byte-identical — no tag emitted)', () => {
  const out = resolveDetailCanonical({
    origin: 'https://example.com',
    pageConfigs: [],
    currentPage: { name: 'SM', slug: 'santa-monica', format: 'collection-list', collectionId: null, labels: {} },
    currentUrl: 'https://example.com/santa-monica/botox',
    item,
    canonicalFrom: undefined,
  });
  assert.equal(out, undefined);
});

test("resolveDetailCanonical: 'self' returns the current URL", () => {
  const out = resolveDetailCanonical({
    origin: 'https://example.com',
    pageConfigs: [],
    currentPage: { name: 'SM', slug: 'santa-monica', format: 'collection-list', collectionId: null, labels: {} },
    currentUrl: 'https://example.com/santa-monica/botox',
    item,
    canonicalFrom: 'self',
  });
  assert.equal(out, 'https://example.com/santa-monica/botox');
});

test("resolveDetailCanonical: 'primary' resolves to the unscoped host page carrying the same itemCollectionId", () => {
  const currentPage = {
    name: 'SM', slug: 'santa-monica', format: 'collection-list', collectionId: null, labels: {},
    detailPage: { itemCollectionId: 'treatments-coll', scope: { field: 'locations', value: 'Santa Monica' } },
  };
  const primaryPage = {
    name: 'Treatments', slug: 'injectables-fillers', format: 'collection-list', collectionId: null, labels: {},
    detailPage: { itemCollectionId: 'treatments-coll', itemKeyField: 'slug' },
  };
  const out = resolveDetailCanonical({
    origin: 'https://example.com',
    pageConfigs: [currentPage, primaryPage] as never,
    currentPage: currentPage as never,
    currentUrl: 'https://example.com/santa-monica/botox',
    item,
    canonicalFrom: 'primary',
  });
  assert.equal(out, 'https://example.com/injectables-fillers/botox');
});

test("resolveDetailCanonical: 'primary' with no unscoped host found ⇒ degrades to 'self' (never omitted)", () => {
  const currentPage = {
    name: 'SM', slug: 'santa-monica', format: 'collection-list', collectionId: null, labels: {},
    detailPage: { itemCollectionId: 'treatments-coll', scope: { field: 'locations', value: 'Santa Monica' } },
  };
  const out = resolveDetailCanonical({
    origin: 'https://example.com',
    pageConfigs: [currentPage] as never,
    currentPage: currentPage as never,
    currentUrl: 'https://example.com/santa-monica/botox',
    item,
    canonicalFrom: 'primary',
  });
  assert.equal(out, 'https://example.com/santa-monica/botox');
});

test("resolveDetailCanonical: 'primary' with no itemCollectionId at all ⇒ degrades to 'self'", () => {
  const currentPage = { name: 'SM', slug: 'santa-monica', format: 'collection-list', collectionId: null, labels: {} };
  const out = resolveDetailCanonical({
    origin: 'https://example.com',
    pageConfigs: [],
    currentPage: currentPage as never,
    currentUrl: 'https://example.com/santa-monica/botox',
    item,
    canonicalFrom: 'primary',
  });
  assert.equal(out, 'https://example.com/santa-monica/botox');
});
