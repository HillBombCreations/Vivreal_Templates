import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rendererCommerce } from './rendererCommerce.ts';
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
