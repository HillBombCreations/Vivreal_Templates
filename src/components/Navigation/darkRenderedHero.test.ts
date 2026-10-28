import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { darkRenderedHero } from './darkRenderedHero.ts';
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
