import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rendererCommerce } from './rendererCommerce.ts';
import { readCommerce } from './api/siteData/commerce.ts';
// The renderer's own predicate, by file path (its entry point loads React
// components the plain-Node runner cannot; this module is pure).
import { isListNotForSale, NOT_FOR_SALE } from '../../node_modules/@hillbombcreations/site-renderer/dist/lib/itemAction.js';

test('ALLOW (F-C19): a paused or moving shop tells the renderer, which draws Not for sale', () => {
  for (const state of ['paused', 'moving'] as const) {
    const commerce = rendererCommerce({ paymentsProvider: 'square', commerce: { state, lists: { l1: state } } });
    assert.deepEqual(commerce, { paymentsProvider: 'square', state });
    assert.equal(isListNotForSale(commerce), true);
  }
  assert.equal(NOT_FOR_SALE, 'Not for sale right now');
});

test('ALLOW (FP2-02): a shop not ready to take orders (Client 37454c9 site-data-commerce-not-ready.json) draws Not for sale', () => {
  const commerce = rendererCommerce({ paymentsProvider: 'stripe', commerce: readCommerce({ state: 'paused', lists: {}, ready: false }) });
  assert.deepEqual(commerce, { paymentsProvider: 'stripe', state: 'paused' });
  assert.equal(isListNotForSale(commerce), true);
});

test('REFUSE (FP2-02): a ready shop that is selling keeps Add', () => {
  const commerce = rendererCommerce({ paymentsProvider: 'stripe', commerce: readCommerce({ state: 'selling', lists: {}, ready: true }) });
  assert.equal('state' in commerce, false);
  assert.equal(isListNotForSale(commerce), false);
});

test('REFUSE (F-C19): a selling shop, an older payload or an unknown state keeps Add', () => {
  const cases = [
    rendererCommerce({ paymentsProvider: 'stripe', commerce: { state: 'selling', lists: {} } }),
    rendererCommerce({ paymentsProvider: 'stripe' }),
    // Cast: an unrecognised value from a future writer.
    rendererCommerce({ paymentsProvider: 'stripe', commerce: { state: 'frozen', lists: {} } as unknown as { state: 'selling'; lists: Record<string, never> } }),
    rendererCommerce(undefined),
  ];
  for (const commerce of cases) {
    assert.equal('state' in commerce, false);
    assert.equal(isListNotForSale(commerce), false);
  }
});
