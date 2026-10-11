/**
 * RT5-176: an item's meta and card description never quote an untouched kit
 * seed instruction; the page's own description stands in for it.
 *
 * `generateMetadata` itself lives in `[slug]/[itemId]/page.tsx`, which is JSX
 * and cannot be loaded by this repo's `node --test` runner. Its item
 * description comes from `detailItemMetaText` (collection, recipe and menu
 * arms) and `productItemMetaText` (the product arm), so those are called here
 * with the inputs `generateMetadata` passes them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUnfilledSeedCopy, withoutSeedCopy } from './seedCopy.ts';
import { detailItemMetaText } from './detailItemMetaText.ts';
import { productItemMetaText } from './productItemMeta.ts';

const SEED = '<p>Placeholder journal entry. Replace with your own writing.</p>';
const REAL = '<p>Our sourdough rests for two days before it is baked.</p>';

test('REFUSE the kit seed wording, in any case and wrapped in HTML', () => {
  assert.equal(isUnfilledSeedCopy(SEED), true);
  assert.equal(isUnfilledSeedCopy('PLACEHOLDER bio, REPLACE WITH your story.'), true);
  assert.equal(withoutSeedCopy(SEED), undefined);
});

test('ALLOW real copy, including copy that mentions a placeholder or replacing', () => {
  assert.equal(isUnfilledSeedCopy(REAL), false);
  assert.equal(isUnfilledSeedCopy('No placeholder parts. Replace with an original, always.'), false);
  assert.equal(isUnfilledSeedCopy('Placeholder text we kept on purpose.'), false, 'begins that way but asks nothing');
  assert.equal(isUnfilledSeedCopy(undefined), false);
  assert.equal(isUnfilledSeedCopy(''), false);
  assert.equal(withoutSeedCopy(REAL), REAL);
});

const ITEM_META = {
  itemTitle: 'What a trial is for',
  recipeSummary: undefined,
  siteName: 'Marquee',
  patternTitle: undefined,
  patternDescription: undefined,
  pageMetaTitle: undefined,
  pageMetaDescription: 'Notes from the salon floor.',
  pageSubtitle: 'The journal',
  pageName: 'Journal',
};

test('REFUSE a seed item description in the collection item meta; the page description stands in', () => {
  const out = detailItemMetaText({ ...ITEM_META, itemDescription: SEED });
  assert.equal(out.description, 'Notes from the salon floor.');
  assert.equal(out.title, 'What a trial is for | Marquee', 'the item still names its page');
});

test('REFUSE a seed recipe summary; with no page description the page subtitle stands in', () => {
  const out = detailItemMetaText({ ...ITEM_META, pageMetaDescription: undefined, recipeSummary: SEED, itemDescription: SEED });
  assert.equal(out.description, 'The journal');
});

test('ALLOW a real item description in the collection item meta, exactly as before', () => {
  const out = detailItemMetaText({ ...ITEM_META, itemDescription: REAL });
  assert.equal(out.description, 'Our sourdough rests for two days before it is baked.');
});

const PRODUCT_META = {
  itemTitle: 'Country loaf',
  siteName: 'Marquee',
  patternTitle: undefined,
  patternDescription: undefined,
  pageSubtitle: 'Baked every morning',
  pageName: 'Shop',
};

test('REFUSE a seed product description; the shop subtitle stands in', () => {
  assert.equal(productItemMetaText({ ...PRODUCT_META, itemDescription: SEED }).description, 'Baked every morning');
});

test('ALLOW a real product description, exactly as before', () => {
  assert.equal(
    productItemMetaText({ ...PRODUCT_META, itemDescription: REAL }).description,
    'Our sourdough rests for two days before it is baked.',
  );
});
