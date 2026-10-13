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
import { seedFreeMeta, seedFreeText } from './seedFreeText.ts';

const PARTLY_SEEDED = 'Three sessions over six weeks. Placeholder journal entry. Replace with your own writing.';
const KEPT = 'Three sessions over six weeks.';

test('REFUSE (W25f-1): a partly seeded description publishes only its real sentence, as text and as HTML', () => {
  assert.equal(seedFreeText(PARTLY_SEEDED, 500), KEPT);
  assert.equal(seedFreeText(`<p>${PARTLY_SEEDED}</p>`, 500), KEPT);
  assert.equal(seedFreeText(PARTLY_SEEDED, 160), KEPT, 'the 160 meta cut too');
});

test('REFUSE (W25f-1): a description that is seed as a whole publishes nothing', () => {
  assert.equal(seedFreeText('This is placeholder copy for a demonstration template. Replace it with your own story.', 500), undefined);
  assert.equal(seedFreeText('<p>Placeholder bio, replace with your story.</p>', 500), undefined);
});

test('ALLOW (W25tc-1): a visitor disclaimer beside a real sentence is published whole', () => {
  const caption = 'Three sessions over six weeks. Illustrative placeholder photography, not a patient result.';
  assert.equal(seedFreeText(caption, 500), caption);
});

// F-1 changed this from 'Placeholder biography.': the seed rule keeps the
// disclosure, but a disclosure on its own is no description (seedFreeText.ts).
test('REFUSE (F-1): a person line left with only its disclaimer publishes nothing', () => {
  assert.equal(seedFreeText('<p>Placeholder biography, replace with your story.</p>', 500), undefined);
});

// F-1, the Halo journal entry shape, verbatim from the salon-blo kit.
const HALO_JOURNAL = 'Placeholder journal entry. Replace with your own writing.';

test('REFUSE (F-1): the Halo journal entry, and its disclosure alone, are no metadata', () => {
  for (const value of [HALO_JOURNAL, `<p>${HALO_JOURNAL}</p>`, 'Placeholder journal entry.', 'Placeholder press coverage for the demonstration template.']) {
    assert.equal(seedFreeMeta(value), undefined, value);
    assert.equal(seedFreeText(value, 160), undefined, value);
  }
});

test('ALLOW (F-1): a real article excerpt is returned by reference, unchanged', () => {
  const excerpt = '<p>Why we cut dry: you see the shape you will actually wear, not the one water gives you.</p>';
  assert.equal(seedFreeMeta(excerpt), excerpt);
  assert.equal(seedFreeText(excerpt, 160), 'Why we cut dry: you see the shape you will actually wear, not the one water gives you.');
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

test('REFUSE (W25f-1): no site uses the seed rule as a yes/no check and then publishes the original', () => {
  assert.doesNotMatch(page, /(?:withoutSeedCopy|seedFreeMeta)\([^)]*\)\s*\?\s*[{(]?/, 'a ternary on the seed rule');
  assert.doesNotMatch(page, /&&\s*(?:withoutSeedCopy|seedFreeMeta)\(/, 'the seed rule behind &&');
  assert.ok(/seedFreeMeta\(seo\?\.metaDescription\)/.test(page), 'control: the same file is read and the pattern can match a real call');
});

// F-1: metadata drops a disclosure-only value, which the renderer's rule keeps,
// so no metadata site may call the renderer's rule directly.
test('REFUSE (F-1): no metadata module calls withoutSeedCopy directly', () => {
  const modules = [
    '../../app/[slug]/[itemId]/page.tsx',
    './detailItemMetaText.ts',
    './productItemMeta.ts',
    './pageMetaText.ts',
    '../../components/JsonLd/schema.ts',
  ];
  for (const rel of modules) {
    const src = fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /withoutSeedCopy\(/, rel);
    assert.match(src, /seedFreeMeta\(|seedFreeText\(/, `control: ${rel} is read and calls the metadata rule`);
  }
});

// F-1 review: the disclosure list is closed. Every shipped disclosure, alone, is no metadata.
const SHIPPED_DISCLOSURES = [
  'Placeholder note.',
  'Placeholder journal entry.',
  'Placeholder photography.',
  'Placeholder body copy.',
  'Placeholder biography.',
  'Placeholder text.',
  'Placeholder terms text.',
  'Placeholder policy text.',
  'Placeholder policy copy.',
  'Placeholder accessibility text.',
  'Placeholder text message terms.',
  'Placeholder press coverage for the demonstration template.',
  'Placeholder testimonials for the demonstration template.',
  'Illustrative placeholder photography.',
  'Illustrative placeholder photography, not a patient result.',
  `Illustrative placeholder photography ${String.fromCharCode(0x2014)} not a patient result.`,
  'The set below is illustrative placeholder photography.',
  'This is placeholder copy for a demonstration template.',
  'Placeholder text supplied with the Vivreal template gallery.',
  'This is placeholder policy text supplied with the Vivreal template gallery.',
  'The venue, business details, pricing, vendors and photography on this site are example content.',
  'The words on this page are example copy.',
  'All photography is licensed from Unsplash and stands in for your own.',
  'All photography is licensed from Unsplash and used here as placeholder art.',
  'Every photograph here is a stock image.',
];

test('REFUSE (F-1 review): every shipped kit disclosure, alone or two together, is no metadata', () => {
  for (const value of SHIPPED_DISCLOSURES) {
    assert.equal(seedFreeMeta(value), undefined, value);
    assert.equal(seedFreeMeta(`<p>${value}</p>`), undefined, `<p>${value}</p>`);
  }
  assert.equal(seedFreeMeta('Placeholder photography. Every photograph here is a stock image.'), undefined);
});

test('ALLOW (F-1 review): a real sentence that uses a disclosure word keeps its description', () => {
  for (const value of [
    'Custom placeholder cards for weddings and events.',
    'We replace placeholder copy with words that sell.',
    'A demonstration of our template for florists.',
    'A demonstration template for florists.',
    'These are example content ideas for your launch.',
    'Our menu cards are example content you can order.',
    'Placeholder cards, hand lettered.',
  ]) {
    assert.equal(seedFreeMeta(value), value, value);
  }
});
