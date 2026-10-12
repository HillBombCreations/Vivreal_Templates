/**
 * W25f-1 review BLOCK 1: item JSON-LD and meta descriptions publish the value
 * `withoutSeedCopy` RETURNS, never the original. `[slug]/[itemId]/page.tsx` is
 * JSX and cannot load under `node --test`, so the helper every one of its
 * description sites calls is tested by calling it, and the route is pinned to
 * call it at each site.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seedFreeText } from './seedFreeText.ts';

const PARTLY_SEEDED = 'Three sessions over six weeks. Illustrative placeholder photography, not a patient result.';
const KEPT = 'Three sessions over six weeks.';

test('REFUSE (W25f-1): a partly seeded description publishes only its real sentence, as text and as HTML', () => {
  assert.equal(seedFreeText(PARTLY_SEEDED, 500), KEPT);
  assert.equal(seedFreeText(`<p>${PARTLY_SEEDED}</p>`, 500), KEPT);
  assert.equal(seedFreeText(PARTLY_SEEDED, 160), KEPT, 'the 160 meta cut too');
});

test('REFUSE (W25f-1): a description that is seed as a whole publishes nothing', () => {
  assert.equal(seedFreeText('Illustrative placeholder photography, not a patient result.', 500), undefined);
  assert.equal(seedFreeText('<p>Placeholder biography, replace with your story.</p>', 500), undefined);
});

test('ALLOW (W25f-1): a real description is stripped and cut exactly as before', () => {
  const real = '<p>Three sessions over six <strong>weeks</strong>.</p>';
  assert.equal(seedFreeText(real, 500), 'Three sessions over six weeks.');
  assert.equal(seedFreeText('x'.repeat(600), 500), 'x'.repeat(500));
  for (const empty of [undefined, null, '', 7, { text: 'a' }]) assert.equal(seedFreeText(empty, 500), undefined);
});

const page = fs.readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');

test('REFUSE (W25f-1): every detail description site in the item route goes through seedFreeText', () => {
  const sites = [
    'description: seedFreeText(show.description, 500)', // show JSON-LD
    'const memberDescription = seedFreeText(member.description, 500)', // team JSON-LD
    'const productDescription = seedFreeText(offerFieldValue(product.description, offerVariant, variantValues), 500)', // product JSON-LD
    'const cleanDesc = seedFreeText(effectiveItem.description, 500)', // collection item JSON-LD and meta
    'const cleanDesc = seedFreeText(item.description, 500)', // menu item JSON-LD
    'const cleanDesc = seedFreeText(show.description, 160)', // show meta
  ];
  for (const site of sites) assert.ok(page.includes(site), `missing: ${site}`);
});

test('REFUSE (W25f-1): no site uses withoutSeedCopy as a yes/no check and then publishes the original', () => {
  assert.doesNotMatch(page, /withoutSeedCopy\([^)]*\)\s*\?\s*[{(]?/, 'a ternary on withoutSeedCopy');
  assert.doesNotMatch(page, /&&\s*withoutSeedCopy\(/, 'withoutSeedCopy behind &&');
  assert.ok(/withoutSeedCopy\(seo\?\.metaDescription\)/.test(page), 'control: the same file is read and the pattern can match a real call');
});
