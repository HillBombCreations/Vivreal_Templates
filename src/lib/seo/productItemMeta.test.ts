import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productItemMetaText } from './productItemMeta.ts';

const BASE = {
  itemTitle: 'Maison Corbel Petit Cartable',
  itemDescription: '<p>Hand-set turnlock, rolled top handle &amp; suede lining.</p>',
  siteName: 'Marlowe & Kept',
  patternTitle: undefined,
  patternDescription: undefined,
  pageSubtitle: 'Forty-eight pieces, each one of one.',
  pageName: 'Shop',
};

test('Phase 0.3 (D4): the product names its own page', () => {
  assert.deepEqual(productItemMetaText(BASE), {
    title: 'Maison Corbel Petit Cartable | Marlowe & Kept',
    description: 'Hand-set turnlock, rolled top handle & suede lining.',
  });
});

test('the description falls back to the page subtitle, then to the title', () => {
  assert.equal(productItemMetaText({ ...BASE, itemDescription: '' }).description, 'Forty-eight pieces, each one of one.');
  assert.equal(productItemMetaText({ ...BASE, itemDescription: undefined, pageSubtitle: undefined }).description, 'Maison Corbel Petit Cartable | Marlowe & Kept');
});

test('authored detail patterns still win', () => {
  const out = productItemMetaText({ ...BASE, patternTitle: 'Buy the Petit Cartable', patternDescription: 'One of one.' });
  assert.deepEqual(out, { title: 'Buy the Petit Cartable', description: 'One of one.' });
});

test('a blank item title falls back to the page name', () => {
  assert.equal(productItemMetaText({ ...BASE, itemTitle: '   ' }).title, 'Shop | Marlowe & Kept');
});

test('a description is capped at 160 characters', () => {
  assert.ok(productItemMetaText({ ...BASE, itemDescription: 'x'.repeat(400) }).description.length <= 160);
});
