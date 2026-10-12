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

/**
 * Renderer 1.85.6 widened `decodeEntities` (named typographic and Latin-1
 * names, the en/em/thin spaces, exact case first, a Map so prototype names
 * stay literal). The space entities are the ones that change a seed verdict,
 * because they decode to whitespace the collapse folds; the rest pin that the
 * two rules still agree where the verdict does not move.
 */
const NAMED_ENTITY_VECTORS: ReadonlyArray<readonly [string, boolean]> = [
  ['Placeholder&ensp;bio, replace&emsp;with yours.', true],
  ['Placeholder&thinsp;bio, replace&thinsp;with yours.', true],
  ['&ensp;Placeholder bio, replace with yours.', true],
  ['Placeholder&ENSP;bio, replace&EMSP;with yours.', true],
  ['Placeholder&rsquo;s bio. Replace&ensp;with yours.', true],
  ['Placeholder caf&eacute; bio, replace with yours.', true],
  ['&Eacute;clair placeholder, replace with yours.', false],
  ['Placeholder bio, replace&sup2;with yours.', false],
  ['&constructor; Placeholder bio, replace with yours.', false],
  ['Placeholder bio, replace&amp;ensp;with yours.', false],
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

/*
 * W25f-1 (renderer 1.85.7): the kit wordings are found at any sentence start,
 * and only the seed is cut. These tables are copied VERBATIM from
 * vivreal-site-renderer `src/composition/seedCopyMidSentence.test.tsx` at
 * 99caa5b (`WALK_LINES`, `UNREPORTED_KIT_LINES`, `OWNER_SENTENCES`,
 * `ADVERSARIAL_KEPT`, `JUNIPER_ABOUT`), where the same inputs run through the
 * renderer's own `withoutSeedText` with the same expected results.
 */
const WALK_LINES: ReadonlyArray<readonly [string, string]> = [
  ['blackbird /accessibility-statement', 'Example text. Describe your own step free routes, your door widths and your toilets, and be specific about what is not accessible.'],
  ['blackbird /credits', 'The words on this page are example copy. Replace them with your own.'],
  ['fernbrook /credits', 'The properties, pricing, vendors and photography on this site are example content. Replace them with your own before you go live.'],
  ...[
    'Texture and scarring, series of three.',
    'Midface, two syringes across two visits.',
    'Border definition, single visit.',
    'Forehead and glabella, one session.',
    'Pigment and tone, medium depth.',
    'Full face, single session.',
    'Jaw and chin, built across two visits.',
    'Diffuse redness, series of three.',
  ].flatMap((subject) => [
    ['juniper /', `${subject} Illustrative placeholder photography, not a patient result.`] as const,
    ['juniper /before-after', `${subject} Illustrative placeholder photography, not a patient result.`] as const,
  ]),
  ['juniper /before-after', 'Baseline and review photographs are taken under fixed lighting so the comparison is a real one. The set below is illustrative placeholder photography.'],
  ['juniper /before-after', 'Baseline and review photographs are taken under fixed lighting so the comparison is a real one. The set below is illustrative placeholder photography.'],
  ['juniper /about', 'This is placeholder copy for a demonstration template. Replace it with your own story before publishing.'],
  ['juniper /press', 'Placeholder press coverage for the demonstration template.'],
  ['juniper /press', 'Placeholder press coverage for the demonstration template.'],
  ['juniper /testimonials', 'Placeholder testimonials for the demonstration template.'],
  ['juniper /testimonials', 'Placeholder testimonials for the demonstration template.'],
  ['larkspur /credits', 'The venue, business details, pricing, vendors and photography on this site are example content. Replace them with your own before you go live.'],
  ['larkspur /credits', 'All photography is licensed from Unsplash and used here as placeholder art. Swap in your own before going live. Your rooms are the reason someone books.'],
  ['windward /credits', 'The house, pricing, press notes and photography on this site are example content. Replace them with your own before you go live.'],
];

const UNREPORTED_KIT_LINES = [
  'Every photograph here is a stock image. Swap them for your own before you go live.',
  'All photography is licensed from Unsplash and stands in for your own. Swap it before going live. Your gardens are the reason someone books.',
  'All photography is licensed from Unsplash and stands in for your own. Swap it before going live. Your shoreline is the reason someone books.',
  'This is placeholder policy text supplied with the Vivreal template gallery. Replace it with your own privacy policy before taking the site live.',
];

const OWNER_SENTENCES = [
  'Every photo on this page is a real patient result, shared with consent.',
  'Results vary. The photos below show a patient result after three sessions, not a promise.',
  'Not a patient result we are proud of? We redo it free.',
  'We built this site from a template and made every page our own.',
  'Our template for a good facial: cleanse, treat, protect.',
  'The demonstration of our new template range is on Friday.',
  'No illustrative placeholder photography here. Every image is a client.',
  'Illustrative photography by Ana Ruiz.',
  'Our placeholder sign went up in May. The real one is coming.',
  'This is our placeholder menu until spring, ask us for the full one.',
  'Placeholder Coffee is next door, and we share their beans.',
  'Example text messages arrive the day before your visit.',
  'These are example menus. Ask us for this week.',
  'Our tasting flights are examples of what we pour. Swap in your own picks at the bar.',
  'Swap it for oat milk at no charge.',
  'Swap them before you leave if they do not fit.',
  'Our policy text is plain English. Replace it with nothing, it is final.',
  'The set below is our own photography, taken in the studio.',
  'Go live with us on Friday: the doors open at six.',
  'Stock images are never used here; every photograph is ours.',
  '<p>We are a family bakery.</p><p>Our placeholder cakes in the window are real cakes.</p>',
];

const ADVERSARIAL_KEPT: ReadonlyArray<readonly [string, string]> = [
  ['placeholder/replace', 'We use butter. Placeholder tiles go down first, and then we replace with porcelain.'],
  ['placeholder/replace', 'Our crew lays the floor. Placeholder boards protect it. If one cracks we replace with oak.'],
  ['placeholder/replace', 'Grout the joints. Placeholder: none. Out of milk? Replace with oat milk.'],
  ['placeholder/replace', '<p>Our bakery opened in 2009.</p><p>Placeholder cakes sit in the window while the real ones chill.</p><p>No eggs? We replace with flax.</p>'],
  ['placeholder/replace', 'Our studio is small. Placeholder frames hang while prints dry, and the team will replace with the final piece on Friday.'],
  ['journal', 'We blog weekly. Placeholder body copy for the journal entry titled “Spring” is what we never publish.'],
  ['placeholder text', 'Our signs never read placeholder text. Ask us for a custom one.'],
  ['placeholder text', 'We print menus. Placeholder texts arrive by SMS.'],
  ['illustrative', 'We shoot in house. Illustrative placeholder photography is something we never use.'],
  ['illustrative', 'Results vary. This is not a patient result we would show; every photo is a real client.'],
  ['template placeholder', 'Signs are lettered by hand. Template placeholder. Ours are not.'],
  ['example text', 'This is example text. Replace it with nothing, it is final.'],
  ['set below', 'Our gallery is real. The set below is illustrative placeholder photography? No, all real clients.'],
  ['placeholder copy', 'Our menu changes weekly. This is placeholder copy until we finalise spring.'],
  ['placeholder copy', 'This is placeholder copy for a demonstration template launch next week.'],
  ['policy text', 'This is placeholder policy text supplied with the Vivreal template gallery? No, our lawyer wrote it.'],
  ['press', 'We were the placeholder for the demonstration template launch.'],
  ['press', 'Placeholder testimonials for the demonstration template are not something we write; every review is real.'],
  ['describe', 'Kids love the menu. Example text. Describe your own favourite dish when you order.'],
  ['example content', 'Our photos are example content. Replace them with your own eyes when you visit.'],
  ['example copy', 'The words on this page are example copy? No, we wrote every one.'],
  ['placeholder art', 'We used this frame as placeholder art. Swap in your own print at the counter.'],
  ['stock image', 'Every photograph here is a stock image. Swap them for your own before you go live, said nobody.'],
  ['swap it', 'Swap it before going live, our DJ says.'],
  ['swap them', 'Mix the flour and sugar. Swap them for your own before you go live? Never.'],
  ['stands in', 'Our cousin stands in for your own barber when he is away. Swap it before going live? No.'],
];

const JUNIPER_ABOUT =
  '<p>Vesper is a single-suite aesthetics studio in Los Angeles. Four treatment rooms, one provider in each, and a quiet room at the back for infusions.</p>' +
  '<p>The studio was built around three commitments: you stay with one provider, options are presented in order of least intervention first.</p>' +
  '<p>This is placeholder copy for a demonstration template. Replace it with your own story before publishing.</p>';
const ABOUT_KEPT = JUNIPER_ABOUT.slice(0, JUNIPER_ABOUT.lastIndexOf('<p>This is placeholder'));

/** Partly seeded values and the exact text each keeps, from the renderer's own expectations at 99caa5b. */
const CUT_VECTORS: ReadonlyArray<readonly [string, string | undefined]> = [
  [WALK_LINES[3][1], 'Texture and scarring, series of three.'],
  [`<p>${WALK_LINES[3][1]}</p>`, '<p>Texture and scarring, series of three.</p>'],
  [WALK_LINES[19][1], 'Baseline and review photographs are taken under fixed lighting so the comparison is a real one.'],
  [JUNIPER_ABOUT, ABOUT_KEPT],
  [`<p>${WALK_LINES[1][1]}</p><p>${UNREPORTED_KIT_LINES[0]}</p>`, undefined],
  [
    "<p>Template placeholder. This page is intentionally not carrying the donor site's verbatim privacy policy.</p>" +
      '<p>The page exists so the route, the footer link and the Studio editing surface are all in place from the first load.</p>',
    undefined,
  ],
  ['We cut hair on Elm Street. Placeholder note. Replace with how long they have been cutting. Walk-ins welcome.', 'We cut hair on Elm Street. Walk-ins welcome.'],
  [`${WALK_LINES[1][1]} ${UNREPORTED_KIT_LINES[0]}`, undefined],
  ['Open daily from 7am.<br>The words on this page are example copy. Replace them with your own.<br/>Free parking behind the shop.', 'Open daily from 7am.<br>Free parking behind the shop.'],
  ['Open daily from 7am.<br>Every photograph here is a stock image. Swap them for your own before you go live.', 'Open daily from 7am.'],
  [`${WALK_LINES[0][1]}<br>${WALK_LINES[1][1]}`, undefined],
  ['Open daily from 7am.<br><br>The words on this page are example copy. Replace them with your own.<br><br>Free parking behind the shop.', 'Open daily from 7am.<br><br>Free parking behind the shop.'],
  ['<p>Real line.<br>Every photograph here is a stock image. Swap them for your own before you go live.</p>', '<p>Real line.</p>'],
  // Known limit, as in the renderer: a seed after a line with no closing punctuation stays.
  ['Open daily<br>Placeholder note. Replace with yours.', 'Open daily<br>Placeholder note. Replace with yours.'],
];

const KIT_WORDS = /placeholder|example (?:copy|content|text)|swap (?:it|them|in)|replace (?:it|them) with/i;

test('W25f-1 ALLOW: every one of the 29 walk lines loses its kit instruction, as text and as HTML', () => {
  assert.equal(WALK_LINES.length, 29, 'the walk counted 29 lines');
  for (const [where, line] of WALK_LINES) {
    for (const value of [line, `<p>${line}</p>`]) {
      const out = withoutSeedCopy(value);
      assert.ok(out === undefined || (typeof out === 'string' && !KIT_WORDS.test(out)), `${where}: ${String(out)}`);
      assert.notEqual(out, value, `${where}: changed`);
    }
  }
});

test('W25f-1 ALLOW: the kit credits and policy lines the walk net missed are hidden too', () => {
  for (const line of UNREPORTED_KIT_LINES) assert.equal(isUnfilledSeedCopy(line), true, line);
});

test('W25f-1 REFUSE: real owner sentences and adversarial look-alikes come back as the SAME value', () => {
  for (const line of [...OWNER_SENTENCES, ...ADVERSARIAL_KEPT.map(([, l]) => l)]) {
    assert.equal(isUnfilledSeedCopy(line), false, line);
    assert.equal(withoutSeedCopy(line), line, `same value back: ${line}`);
  }
});

test('W25f-1: a partly seeded value keeps its real paragraphs, lines and sentences; only the seed is cut', () => {
  for (const [input, expected] of CUT_VECTORS) assert.equal(withoutSeedCopy(input), expected, input);
  assert.equal(isUnfilledSeedCopy(JUNIPER_ABOUT), false, 'not seed as a whole');
});

// Measured as a RATIO inside one run, so a busy machine slows both sizes alike. A quadratic
// shape (the 1.85.7 B1 review: 67 ms at 50 KB, 1,560 ms at 200 KB) is 16x or worse; linear is 4x.
// The 2 ms floor keeps timer jitter on sub-millisecond runs from reading as growth.
function bestMs(fn: (value: string) => unknown, value: string): number {
  let ms = Number.POSITIVE_INFINITY;
  for (let run = 0; run < 5; run++) {
    const t0 = process.hrtime.bigint();
    fn(value);
    ms = Math.min(ms, Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return ms;
}

/** The ratio check: 4x the input may cost at most 8x the time, plus the jitter floor. */
function scalesLinearly(fn: (value: string) => unknown, shape: (n: number) => string): { ok: boolean; detail: string } {
  const small = shape(3900);
  const large = shape(15600);
  assert.ok(large.length >= 180_000 && large.length >= 3.9 * small.length, `sizes ${small.length} / ${large.length}`);
  const tSmall = bestMs(fn, small);
  const tLarge = bestMs(fn, large);
  return { ok: tLarge <= 8 * tSmall + 2, detail: `${small.slice(0, 24)}...: ${tSmall.toFixed(2)} ms at ${small.length}, ${tLarge.toFixed(2)} ms at ${large.length}` };
}

test('W25f-1: matching stays linear, 4x the input costs about 4x the time, not 16x', () => {
  const shapes: Array<(n: number) => string> = [
    (n) => 'Placeholder. '.repeat(n),
    (n) => `Real start. ${'Placeholder tiles go down first, and we replace with porcelain. '.repeat(n / 5)}`,
    (n) => `${'Real start. '.repeat(n)}Placeholder note. Replace with yours.`,
    (n) => 'This is placeholder. '.repeat(n),
  ];
  for (const shape of shapes) {
    const { ok, detail } = scalesLinearly(withoutSeedCopy, shape);
    assert.ok(ok, detail);
  }
});

test('CONTROL: the ratio check FAILS a deliberately quadratic scan, so the linearity test can go red', () => {
  // One indexOf from every 13th position to the end of the value: O(n^2 / 13), the B1 shape of cost.
  const quadratic = (value: string): number => {
    let sum = 0;
    for (let i = 0; i < value.length; i += 13) sum += value.indexOf('zzz', i);
    return sum;
  };
  const { ok, detail } = scalesLinearly(quadratic, (n) => 'Placeholder. '.repeat(n));
  assert.equal(ok, false, `a quadratic scan passed the ratio check: ${detail}`);
});

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

test('parity: the 1.85.6 named-entity vectors decode the same way', () => {
  for (const [input, expected] of NAMED_ENTITY_VECTORS) assert.equal(isUnfilledSeedCopy(input), expected, input);
});

test('parity: the renderer edge vectors strip HTML the same way (tag is a space, numeric entities, script/style/comments)', () => {
  for (const [input, expected] of EDGE_VECTORS) assert.equal(isUnfilledSeedCopy(input), expected, input);
});

test('parity: the INSTALLED renderer agrees with the mirror on every vector', async () => {
  const url = new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/lib/seedCopy.js', import.meta.url);
  // Cast: a dynamic import of a plain-JS dist file has no types; these are its exported signatures.
  const renderer = (await import(url.href)) as {
    isUnfilledSeedCopy?: (v: unknown) => boolean;
    withoutSeedText?: (v: unknown) => unknown;
  };
  const rendererRule = renderer.isUnfilledSeedCopy;
  const rendererCut = renderer.withoutSeedText;
  assert.equal(typeof rendererRule, 'function', 'loaded the renderer module, not nothing');
  assert.equal(typeof rendererCut, 'function', 'the installed renderer carries the 1.85.7 cut rule');
  // The cut text must match too, not only the verdict: every W25f-1 table through both.
  const cutInputs = [
    ...WALK_LINES.flatMap(([, l]) => [l, `<p>${l}</p>`]),
    ...UNREPORTED_KIT_LINES,
    ...OWNER_SENTENCES,
    ...ADVERSARIAL_KEPT.map(([, l]) => l),
    ...CUT_VECTORS.map(([input]) => input),
    ...EDGE_VECTORS.map(([input]) => input),
    ...NAMED_ENTITY_VECTORS.map(([input]) => input),
  ];
  assert.ok(cutInputs.length >= 150, `the cut set carries the 1.85.7 tables (${cutInputs.length})`);
  for (const input of cutInputs) assert.equal(withoutSeedCopy(input), rendererCut?.(input), `cut parity: ${input}`);
  const vectors: Array<readonly [unknown, boolean]> = [
    ...RENDERER_SEEDS.map((s) => [s, true] as const),
    ...RENDERER_REAL.map((s) => [s, false] as const),
    ...RENDERER_NEW_SHAPE_SEEDS.map((s) => [s, true] as const),
    ...RENDERER_NEW_SHAPE_REAL.map((s) => [s, false] as const),
    ...EDGE_VECTORS,
    ...NAMED_ENTITY_VECTORS,
    ...UNREPORTED_KIT_LINES.map((s) => [s, true] as const),
    ...OWNER_SENTENCES.map((s) => [s, false] as const),
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

test('REFUSE (W25f-1): a seed page subtitle or meta description never becomes the item or product meta', () => {
  const seededPage = { ...ITEM_META, pageMetaDescription: 'Placeholder testimonials for the demonstration template.', pageSubtitle: 'Placeholder testimonials for the demonstration template.' };
  assert.equal(detailItemMetaText({ ...seededPage, itemDescription: undefined }).description, 'What a trial is for | Marquee');
  assert.equal(
    productItemMetaText({ ...PRODUCT_META, itemDescription: undefined, pageSubtitle: 'Placeholder press coverage for the demonstration template.' }).description,
    'Country loaf | Marquee',
  );
  assert.equal(detailItemMetaText({ ...ITEM_META, itemDescription: undefined }).description, 'Notes from the salon floor.', 'a real page description still stands in');
});
