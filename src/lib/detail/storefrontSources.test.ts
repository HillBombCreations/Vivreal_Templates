import { test } from 'node:test';
import assert from 'node:assert/strict';
import { providerMissIsFinal, storefrontItemSources } from './storefrontSources.ts';

const RESALE = { format: 'products', detailPage: { itemCollectionId: 'c-shop-catalog' } };
const STRIPE_SHOP = { format: 'products', detailPage: null };

test('Phase 0.1 (D1): the resale shop reads the provider, then its collection, and a provider miss is not final', () => {
  assert.deepEqual(storefrontItemSources(RESALE, undefined), ['provider', 'collection']);
  assert.equal(providerMissIsFinal(RESALE), false);
});

test('a provider storefront with no collection detail keeps its 404 on a miss', () => {
  assert.deepEqual(storefrontItemSources(STRIPE_SHOP, 'stripe'), ['provider']);
  assert.equal(providerMissIsFinal(STRIPE_SHOP), true);
});

test('a non-products page with a payments binding reads the provider, and its miss is never final here', () => {
  assert.deepEqual(storefrontItemSources({ format: 'standard' }, 'square'), ['provider']);
  assert.equal(providerMissIsFinal({ format: 'standard' }), false);
});

test('a recipes page reads only its collection; a plain page reads nothing', () => {
  assert.deepEqual(storefrontItemSources({ format: 'recipes' }, undefined), ['collection']);
  assert.deepEqual(storefrontItemSources({ format: 'standard' }, undefined), []);
});
