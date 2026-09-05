import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECIPES_FORMAT,
  detailJsonLdFormat,
  servesCollectionDetail,
} from './detailFormats.ts';

/**
 * Phase 1 exit criterion #1: a recipe URL resolves rather than 404s.
 *
 * `[slug]/[itemId]/page.tsx` is JSX and cannot be loaded by
 * `node --experimental-strip-types`, so the routing DECISION lives here and is
 * tested by being called. `page.test.ts` pins that the route reaches it.
 */

test('a recipes page is served by the collection detail arm', () => {
  // Without this the route falls through to notFound() and EVERY recipe URL is
  // a 404 — an unknown page format is fatal here, unlike an unknown detail
  // section, which the renderer skips silently.
  assert.equal(servesCollectionDetail({ format: RECIPES_FORMAT }), true);
});

test('the formats that were served before are still served', () => {
  assert.equal(servesCollectionDetail({ format: 'collection-list' }), true);
  assert.equal(
    servesCollectionDetail({ format: 'location-hub', detailPage: { itemCollectionId: 'c1' } }),
    true,
    'the scoped-detail opt-in is format-independent by design',
  );
});

test('a format with no arm is still not served', () => {
  // The arm must not become a catch-all: `schedule` and friends have no item
  // to resolve, and claiming them would turn a 404 into a broken page.
  assert.equal(servesCollectionDetail({ format: 'schedule' }), false);
  assert.equal(servesCollectionDetail({ format: 'subscribe' }), false);
  assert.equal(servesCollectionDetail({}), false);
});

test('a recipes page maps to the Recipe JSON-LD branch', () => {
  // The call site used to hardcode "products", which made a `case 'recipes'`
  // in buildDetailJsonLd unreachable — dead code that still reads as coverage.
  assert.equal(detailJsonLdFormat(RECIPES_FORMAT), RECIPES_FORMAT);
});

test('every other format keeps emitting what it emits today', () => {
  // Passing pageConfig.format through verbatim would flip every scoped-detail
  // page on a non-recipes format from Product/Thing to Article, fleet-wide.
  assert.equal(detailJsonLdFormat('collection-list'), 'products');
  assert.equal(detailJsonLdFormat('location-hub'), 'products');
  assert.equal(detailJsonLdFormat(undefined), 'products');
});
