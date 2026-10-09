import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readShowLowStock } from './showLowStock.ts';

/**
 * F2 (storefront T1), release plan contract C5: a boolean passes through, and
 * anything else leaves the key absent so the template's own default decides.
 */

test('ALLOW: false is carried, so the owner can hide "Only 3 left" everywhere', () => {
  assert.deepEqual(readShowLowStock({ showLowStock: false }), { showLowStock: false });
});

test('ALLOW: true is carried, so a template whose default is off can show it', () => {
  assert.deepEqual(readShowLowStock({ showLowStock: true }), { showLowStock: true });
});

test('REFUSE: an absent value stays absent and never reads as off', () => {
  const mapped = readShowLowStock({ tier: 'pro' });
  assert.deepEqual(mapped, {});
  assert.equal('showLowStock' in mapped, false, 'no key at all, not a key holding undefined');
});

test('REFUSE: null, a string or a number never reaches the renderer', () => {
  for (const value of [null, 'yes', 'false', 0, 1, {}]) {
    assert.deepEqual(readShowLowStock({ showLowStock: value }), {}, JSON.stringify(value));
  }
});

test('REFUSE: an unreadable response maps to nothing', () => {
  for (const raw of [null, undefined, 'x', 7]) {
    assert.deepEqual(readShowLowStock(raw), {}, String(raw));
  }
});
