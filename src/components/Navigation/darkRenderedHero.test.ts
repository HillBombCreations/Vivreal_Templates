import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { darkRenderedHero, needsHeroInputAbove, COLLECTION_READING_HERO_VARIANTS } from './darkRenderedHero.ts';
// By path, not package name: the barrel pulls `next/link` (see siteFont.test.ts).
import { renderedHeroFor } from '../../../node_modules/@hillbombcreations/site-renderer/dist/composition/composePage.js';
import { resolveMastheadTone } from '../../../node_modules/@hillbombcreations/site-renderer/dist/chrome/resolveChrome.js';

/**
 * Owner find 3, renderer 1.92.0: on a Mood dark site the home route hands the
 * Navbar shell `renderedHero`, the hero as `composePage` will render it, so a
 * `feature-item` hero whose collection has no qualifying item (it falls
 * through to the plain panel on the dark ground) gets a header that says the
 * top is dark. A non-Dark site never calls `renderedHeroFor` and passes nothing.
 */

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 200, `${relative} was not read (moved or renamed?)`);
  return source;
}

/** Block comments and whole-line `//` comments out, so a docblock cannot satisfy or trip a pin. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const DARK = { chrome: 'dark', surfaceAlt: '#eeeff0' };

type ComposeInput = Parameters<typeof renderedHeroFor>[0];

/** A compose input shaped as `buildPageContext` builds it: sync getters over prefetched maps. */
function homeInput(chrome: 'dark' | 'light', hero: Record<string, unknown>, items: Record<string, unknown[]> = {}): ComposeInput {
  const itemsByCollection = new Map(Object.entries(items));
  const page = {
    name: 'Home', slug: 'home', format: 'home', labels: {}, hero,
    blocks: [{ id: 'hero', type: { kind: 'home-section', dispatchId: 'hero' }, order: -1, enabled: true, config: {} }],
  };
  return {
    page,
    pages: [],
    isHome: true,
    options: { mode: 'live', emitSectionAnchors: false },
    data: {
      getItems: (id: string) => itemsByCollection.get(id) ?? [],
      getIntegrationItems: () => [],
      siteData: { name: 'Blackbird Hall', chrome, 'surface-alt': '#eeeff0', primary: '#7a1f2b', surface: '#ffffff', pageConfigs: [] },
    },
  } as unknown as ComposeInput; // the fixture builds only the fields the pipeline reads, as the renderer's own renderedHeroFor test does
}

const EMPTY_FEATURE = { title: 'Live at the Hall', variant: 'feature-item', featureItem: { collectionId: 'c-shows', select: 'next-dated' } };
const FILLED_FEATURE = { title: 'Live at the Hall', variant: 'feature-item', featureItem: { collectionId: 'c-shows', select: 'first' } };

test('ALLOW: Dark, a feature-item hero with an empty collection: the page-top answer is dark', () => {
  const input = homeInput('dark', EMPTY_FEATURE);
  const renderedHero = darkRenderedHero('dark', input, renderedHeroFor);
  assert.ok(renderedHero, 'the pipeline rendered no hero; this test proves nothing');
  assert.equal(renderedHero.featureItem, undefined, 'no upcoming item, so the hero fell through');
  // Control: the stored hero alone does not say dark, so the rendered hero is what decides.
  assert.notEqual(resolveMastheadTone(input.page, DARK), 'dark');
  assert.equal(resolveMastheadTone(input.page, { ...DARK, renderedHero }), 'dark');
});

test('REFUSE: Dark, the same hero with a qualifying item keeps the stored answer', () => {
  const input = homeInput('dark', FILLED_FEATURE, { 'c-shows': [{ id: 's1', title: 'Jazz night', source: 'collection', raw: {} }] });
  const renderedHero = darkRenderedHero('dark', input, renderedHeroFor);
  assert.ok(renderedHero?.featureItem, 'the item was not picked; this test proves nothing');
  assert.equal(resolveMastheadTone(input.page, { ...DARK, renderedHero }), resolveMastheadTone(input.page, DARK));
});

test('REFUSE: a non-Dark site never calls renderedHeroFor and gets no hero', () => {
  for (const chrome of ['light', undefined, null, 'Dark', ' dark']) {
    let calls = 0;
    const spy = (input: ComposeInput) => {
      calls += 1;
      return renderedHeroFor(input);
    };
    assert.equal(darkRenderedHero(chrome, homeInput('light', EMPTY_FEATURE), spy), null, String(chrome));
    assert.equal(calls, 0, String(chrome));
  }
  // Control: the same spy IS called on a Dark site, exactly once.
  let calls = 0;
  darkRenderedHero('dark', homeInput('dark', EMPTY_FEATURE), (input: ComposeInput) => {
    calls += 1;
    return renderedHeroFor(input);
  });
  assert.equal(calls, 1);
});

/* ── the second pipeline run is side-effect free ───────────────────────────── */

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('ALLOW: renderedHeroFor writes nothing to the compose input, so composePage sees what it would have', () => {
  const input = deepFreeze(homeInput('dark', FILLED_FEATURE, { 'c-shows': [{ id: 's1', title: 'Jazz night', source: 'collection', raw: {} }] }));
  // ESM is strict mode: a write to a frozen object throws.
  const first = renderedHeroFor(input);
  const second = renderedHeroFor(input);
  assert.ok(first, 'no hero rendered; this test proves nothing');
  assert.deepEqual(second, first);
});

test("the input's item getters are sync reads of prefetched maps (buildPageContext)", () => {
  const src = code(read('../../lib/api/composition/buildPageContext.ts'));
  assert.match(src, /getItems: \(id\) => itemsByCollection\.get\(id\) \?\? \[\],/);
  assert.match(src, /getIntegrationItems: \(type\) => itemsByIntegration\.get\(\(type \?\? ''\)\.toLowerCase\(\)\) \?\? \[\],/);
});

/* ── the wiring ────────────────────────────────────────────────────────────── */

test('the home route computes the hero through the Mood gate and passes it by conditional spread', () => {
  const home = code(read('../../app/page.tsx'));
  assert.match(home, /const renderedHero = darkRenderedHero\(siteData\.chrome, input, renderedHeroFor\);/);
  assert.match(home, /<Navbar\s+page=\{homePageConfig as unknown as RendererPageConfig\}\s+\{\.\.\.\(renderedHero \? \{ renderedHero \} : \{\}\)\}\s+\/>/);
  // REFUSE: no direct call that would bypass the gate, and no attribute form that sends `renderedHero: null`.
  assert.equal((home.match(/renderedHeroFor\(/g) ?? []).length, 0);
  assert.deepEqual(home.match(/\brenderedHero=\{/g) ?? [], []);
});

test('the Navbar shell reads renderedHero only inside the Dark-only object', () => {
  const navbar = code(read('./Navbar.tsx'));
  assert.match(
    navbar,
    /siteData\?\.chrome === 'dark'\s*\?\s*\{\s*chrome: siteData\.chrome,\s*surfaceAlt: [^\n]+,\s*\.\.\.\(renderedHero \? \{ renderedHero \} : \{\}\),\s*\}\s*:\s*null;/,
  );
  assert.equal((navbar.match(/\brenderedHero\b/g) ?? []).length, 4, 'renderedHero is read somewhere outside the Dark-only object');
});

/* ── [slug] routes: await the input above the boundary only when it matters ─ */

/** A compose input for an inner page, as `buildPageContext` builds it for `[slug]`. */
function slugInput(hero: Record<string, unknown>, items: Record<string, unknown[]> = {}, partners = false): ComposeInput {
  const input = homeInput('dark', hero, items) as unknown as { page: Record<string, unknown>; isHome: boolean }; // reshaped below, same fields
  input.isHome = false;
  input.page = {
    ...input.page,
    name: 'Shows', slug: 'shows', format: 'standard',
    blocks: [{
      id: 'hero', type: { kind: 'home-section', dispatchId: 'hero' }, order: -1, enabled: true,
      config: partners ? { bindings: [{ collectionId: 'c-shows', displayAs: 'carousel', role: 'supplemental' }] } : {},
    }],
  };
  return input as unknown as ComposeInput; // the fixture builds only the fields the pipeline reads
}

test('ALLOW: Dark, a feature-item hero on a [slug] page with an empty collection: awaited above, and the answer is dark', () => {
  const input = slugInput(EMPTY_FEATURE);
  assert.equal(needsHeroInputAbove('dark', input.page), true);
  const renderedHero = darkRenderedHero('dark', input, renderedHeroFor);
  assert.ok(renderedHero, 'no hero rendered; this test proves nothing');
  assert.notEqual(resolveMastheadTone(input.page, DARK), 'dark', 'the stored answer is already dark; this test proves nothing');
  assert.equal(resolveMastheadTone(input.page, { ...DARK, renderedHero }), 'dark');
});

test('REFUSE: a non-Dark page, or a Dark page whose hero reads no collection, does not wait above the boundary', () => {
  const cases: Array<[unknown, unknown]> = [
    ['dark', { hero: { variant: 'statement' } }],
    ['dark', { hero: { variant: 'minimal' } }],
    ['dark', { hero: { title: 'No variant' } }],
    ['dark', { hero: null }],
    ['dark', {}],
    ['dark', null],
    ['light', { hero: { variant: 'feature-item' } }],
    [undefined, { hero: { variant: 'feature-item' } }],
    ['Dark', { hero: { variant: 'feature-item' } }],
    ['dark', { hero: { variant: 'Feature-Item' } }],
    ['dark', { hero: 'feature-item' }],
  ];
  for (const [chrome, page] of cases) {
    assert.equal(needsHeroInputAbove(chrome, page as { hero?: unknown }), false, JSON.stringify([chrome, page]));
  }
});

/** Every hero variant the installed renderer names, read from its own dist. */
function rendererHeroVariants(): string[] {
  const dist = new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/', import.meta.url);
  const names = new Set<string>();
  for (const file of ['components/heroArm.js', 'composition/resolveHero.js', 'components/PageHero.js']) {
    const source = fs.readFileSync(new URL(file, dist), 'utf8');
    for (const m of source.matchAll(/variant\s*===\s*'([a-z-]+)'|case '([a-z-]+)':/g)) names.add(m[1] ?? m[2]);
  }
  return [...names].sort();
}

test("COLLECTION_READING_HERO_VARIANTS is exact: the renderer's answer moves with collection data for those variants and no other", () => {
  const variants = rendererHeroVariants();
  assert.ok(variants.length >= 15 && variants.includes('feature-item') && variants.includes('statement'), `parsed ${variants.length} variants: ${variants}`);
  const filled = { 'c-shows': [{ id: 's1', title: 'Jazz night', source: 'collection', raw: {} }] };
  const moved: string[] = [];
  for (const variant of variants) {
    // Every collection-bearing field a stored hero can carry, with and without a designed empty state, and a partners binding.
    const heroes = [
      { title: 'Live at the Hall', variant, featureItem: { collectionId: 'c-shows', select: 'first' } },
      { title: 'Live at the Hall', variant, featureItem: { collectionId: 'c-shows', select: 'first', empty: { title: 'Nothing on' } } },
    ];
    let differs = false;
    for (const hero of heroes) {
      const answer = (items: Record<string, unknown[]>) => {
        const input = slugInput(hero, items, true);
        return resolveMastheadTone(input.page, { ...DARK, renderedHero: renderedHeroFor(input) });
      };
      if (answer({}) !== answer(filled)) differs = true;
    }
    if (differs) moved.push(variant);
  }
  assert.deepEqual(moved, [...COLLECTION_READING_HERO_VARIANTS].sort());
});

test('the [slug] route awaits the input above the boundary only behind the gate, and reads once', () => {
  const slug = code(read('../../app/[slug]/page.tsx'));
  assert.match(
    slug,
    /const heroContext: PageContextResult \| undefined = needsHeroInputAbove\(siteData\.chrome, composedPage\)\s*\?\s*await buildPageContext\(\{ siteData, page: composedPage, isHome: false, productQuery \}\)\s*:\s*undefined;/,
  );
  assert.match(slug, /const renderedHero = heroContext \? darkRenderedHero\(siteData\.chrome, heroContext\.input, renderedHeroFor\) : null;/);
  assert.match(slug, /<Navbar\s+page=\{composedPage as unknown as RendererPageConfig\}\s+\{\.\.\.\(renderedHero \? \{ renderedHero \} : \{\}\)\}\s+\/>/);
  // The body reuses the context, so the page is read once; with none it reads as before.
  assert.match(slug, /\{\.\.\.\(heroContext \? \{ context: heroContext \} : \{\}\)\}/);
  assert.match(slug, /context \?\?\s*\(await buildPageContext\(\{/);
  // REFUSE: no attribute forms that would send undefined props on every other page.
  assert.deepEqual(slug.match(/\b(renderedHero|context)=\{/g) ?? [], []);
});

test('renderComposedPage reads above the boundary for a Dark data hero, after the untouched emptiness guard, and reads once', () => {
  const rcp = code(read('../../lib/renderComposedPage.tsx'));
  // The emptiness block is unchanged (degradedCollectionRead.test.ts pins it).
  assert.match(rcp, /if \(emptinessIsDecidable\(composedPage, productQuery\)\) \{\s*context = await buildPageContext\(\{[^}]*\}\);\s*if \(context\.emptinessUnknown\) refuseUnknownEmptiness\(composedPage\.format\);\s*if \(context\.isEmpty\) notFound\(\);\s*\}/);
  assert.match(rcp, /const heroInputAbove = needsHeroInputAbove\(siteData\.chrome, composedPage\);\s*if \(heroInputAbove && !context\) \{\s*context = await buildPageContext\(\{[^}]*\}\);\s*\}/);
  assert.match(rcp, /const renderedHero = heroInputAbove && context \? darkRenderedHero\(siteData\.chrome, context\.input, renderedHeroFor\) : null;/);
  assert.match(rcp, /<Navbar\s+page=\{composedPage as unknown as RendererPageConfig\}\s+\{\.\.\.\(renderedHero \? \{ renderedHero \} : \{\}\)\}\s+\/>/);
  // composedPageIsEmpty, the emptiness read, the Dark data-hero read, and the body's fallback read.
  assert.equal((rcp.match(/await buildPageContext\(/g) ?? []).length, 4, 'a read was added or lost outside the known four');
});
