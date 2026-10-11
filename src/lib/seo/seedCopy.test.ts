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
import { detailItemMetaText, recipeSummaryMeta } from './detailItemMetaText.ts';
import { productItemMetaText } from './productItemMeta.ts';
import { plainMeta } from './plainMeta.ts';

/*
 * PARITY with the renderer. These three tables are copied VERBATIM from
 * vivreal-site-renderer `src/lib/seedCopy.test.ts` (1.85.4, branch
 * fix/renderer-1.85.4), where the same inputs run through the renderer's own
 * `isUnfilledSeedCopy` with the same expected results. The renderer's package
 * entry point cannot load under plain `node --test` (see `seedCopy.ts`), so the
 * parity test below loads the INSTALLED renderer's `dist/lib/seedCopy.js` by
 * file URL and runs every vector through both. A renderer change to its
 * stripping fails that test on the next re-pin, not silently.
 */
const RENDERER_SEEDS = [
  "Placeholder biography, replace with Priya's training, specialties and the reason she got into this work.",
  '<p>Placeholder policy text. Replace with your own before you go live.</p>',
  'Placeholder journal entry, replace with your own writing.',
  '  <p><strong>PLACEHOLDER</strong> answer, REPLACE WITH the real one.</p>  ',
  '<p>Placeholder&nbsp;caption. Replace with a line about this look.</p>',
];

const RENDERER_REAL = [
  'We never use placeholder ingredients; replace with nothing.',
  'Replace with care: our tailors re-hem anything you buy here.',
  'Placeholder tiles are hand-cut in our studio.',
  'Placeholders, replace with confidence.',
  '<p>A placeholder is fine until you replace with the real photo.</p>',
  'Placeholder text',
  '',
];

const EDGE_VECTORS: ReadonlyArray<readonly [string, boolean]> = [
  ['Place<span>holder</span>, replace with your copy.', false],
  ['Placeholder, re<em>place</em> with your copy.', false],
  ['&#80;laceholder bio, replace with yours.', true],
  ['&#x50;laceholder bio, replace with yours.', true],
  ['<style>p{color:red}</style>Placeholder bio, replace with yours.', true],
  ['<script>var a = 1;</script>Placeholder bio, replace with yours.', true],
  ['<!-- kit note -->Placeholder bio, replace with yours.', true],
  ['Placeholder&nbsp;bio, replace&nbsp;with yours.', true],
  ['Placeholder bio, replace\n\twith yours.', true],
  ['&lt;p&gt;Placeholder bio, replace with yours.', false],
  ['Placeholder&mdash;replace with yours.', true],
  ['Placeholders, replace with yours.', false],
  ['<p>Placeholder</p><p>Replace with your own.</p>', true],
  ['Placeholder &amp; replace with yours.', true],
  ['<script>Placeholder, replace with yours.</script>Real copy here.', false],
  [`<p>Placeholder intro. ${'Slow proved, hand shaped, baked in a stone deck oven. '.repeat(4)}Replace with your own.</p>`, true],
  ['<p> </p>', false],
];

/*
 * W25r-2 (renderer 1.85.5, FP2-08): the four further kit openers and the real
 * copy that sits next to them, VERBATIM from vivreal-site-renderer
 * `src/lib/seedCopy.test.ts` at ddbb240 (`NEW_SHAPE_SEEDS`, `NEW_SHAPE_REAL`).
 */
const RENDERER_NEW_SHAPE_SEEDS = [
  '<p>This is example policy text. Replace it with your own privacy policy before taking the site live.</p>',
  'This is example text. Replace it with your own words.',
  '<p>Placeholder text. Say where the accessible viewing spots are, whether a support worker comes in free.</p>',
  'Placeholder text. Give one email address a visitor can write to about their own data.',
  'Illustrative placeholder photography. Replace with your own consented before-and-after set.',
  'Illustrative placeholder photography, not a patient result.',
  '<p><em>Illustrative placeholder photography</em> — not a patient result.</p>',
  '<p>Template placeholder. This page is intentionally not carrying the donor site’s verbatim terms.</p>',
  '  TEMPLATE PLACEHOLDER.  This page is intentionally empty.',
];

const RENDERER_NEW_SHAPE_REAL = [
  'Our placeholder fence is replaced with oak',
  'Example: replace with your own words',
  'Placeholder texture on the walls is hand-trowelled lime.',
  'Template placeholders are what we avoid. Every page here is ours.',
  'This is example text of the kind we never publish.',
  'This is our policy text. Replace it with nothing, it is final.',
  'We use illustrative photography from our own studio.',
  '<p>Our gallery shows real results. No illustrative placeholder photography here.</p>',
  'Placeholder text',
];

test('ALLOW (FP2-08): every 1.85.5 kit opener is hidden, text and HTML, any case', () => {
  for (const s of RENDERER_NEW_SHAPE_SEEDS) assert.equal(isUnfilledSeedCopy(s), true, s);
});

test('REFUSE (FP2-08): real copy near the 1.85.5 openers, or the wording not at the start, is kept', () => {
  for (const s of RENDERER_NEW_SHAPE_REAL) assert.equal(isUnfilledSeedCopy(s), false, s);
});

test('parity: every renderer seed shape is detected, every renderer real-copy shape is not', () => {
  for (const s of RENDERER_SEEDS) assert.equal(isUnfilledSeedCopy(s), true, s);
  for (const s of RENDERER_REAL) assert.equal(isUnfilledSeedCopy(s), false, s);
});

test('parity: the renderer edge vectors strip HTML the same way (tag is a space, numeric entities, script/style/comments)', () => {
  for (const [input, expected] of EDGE_VECTORS) assert.equal(isUnfilledSeedCopy(input), expected, input);
});

test('parity: the INSTALLED renderer agrees with the mirror on every vector', async () => {
  const url = new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/lib/seedCopy.js', import.meta.url);
  const renderer = (await import(url.href)) as { isUnfilledSeedCopy?: (v: unknown) => boolean };
  const rendererRule = renderer.isUnfilledSeedCopy;
  assert.equal(typeof rendererRule, 'function', 'loaded the renderer module, not nothing');
  const vectors: Array<readonly [unknown, boolean]> = [
    ...RENDERER_SEEDS.map((s) => [s, true] as const),
    ...RENDERER_REAL.map((s) => [s, false] as const),
    ...RENDERER_NEW_SHAPE_SEEDS.map((s) => [s, true] as const),
    ...RENDERER_NEW_SHAPE_REAL.map((s) => [s, false] as const),
    ...EDGE_VECTORS,
    [undefined, false],
  ];
  assert.ok(vectors.length > 40, 'the vector set carries the 1.85.5 shapes');
  for (const [input, expected] of vectors) {
    assert.equal(rendererRule?.(input), expected, `renderer: ${String(input)}`);
    assert.equal(isUnfilledSeedCopy(input), expected, `mirror: ${String(input)}`);
  }
});

test('REFUSE a long recipe seed whose "replace with" falls after character 160: checked before the cut', () => {
  const longSeed = `<p>Placeholder recipe intro. ${'Slow proved for two days, hand shaped and baked in a stone deck oven. '.repeat(3)}Replace with your own.</p>`;
  const plain = longSeed.replace(/<[^>]*>/g, '');
  assert.ok(plain.toLowerCase().indexOf('replace with') > 160, 'the instruction really is past the cut (not vacuous)');
  assert.equal(isUnfilledSeedCopy(plain.slice(0, 160)), false, 'cut first, the seed would read as real copy');
  assert.equal(recipeSummaryMeta(longSeed), undefined);
  const out = detailItemMetaText({ ...ITEM_META, recipeSummary: recipeSummaryMeta(longSeed), itemDescription: undefined });
  assert.equal(out.description, 'Notes from the salon floor.');
});

test('ALLOW a real recipe summary: stripped and cut to 160 exactly as before', () => {
  const real = `<p>${'Slow proved for two days, hand shaped and baked in a stone deck oven. '.repeat(3)}</p>`;
  assert.equal(recipeSummaryMeta(real), plainMeta(real, 160));
  assert.ok(recipeSummaryMeta(real)?.startsWith('Slow proved'));
});

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
