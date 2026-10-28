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

/*
 * RE-RUN ON EVERY RENDERER BUMP. The two derivations below read the installed
 * renderer, so a bump that adds a hero variant, or a hero field that binds a
 * collection, changes what they find. If the exactness test then fails, the
 * gate (`COLLECTION_READING_HERO_VARIANTS`) is out of date: a Dark page with
 * that hero would stream a header that does not match its top.
 */

const RENDERER_DIST = new URL('../../../node_modules/@hillbombcreations/site-renderer/dist/', import.meta.url);

/** Every hero variant the installed renderer names, read from its own dist (identifiers: letters, digits, dashes). */
function rendererHeroVariants(): string[] {
  const names = new Set<string>();
  for (const file of ['components/heroArm.js', 'composition/resolveHero.js', 'components/PageHero.js']) {
    const source = fs.readFileSync(new URL(file, RENDERER_DIST), 'utf8');
    for (const m of source.matchAll(/variant\s*===\s*'([A-Za-z0-9-]+)'|case '([A-Za-z0-9-]+)':/g)) names.add(m[1] ?? m[2]);
  }
  return [...names].sort();
}

/** One step of a path from the hero to an object that carries `collectionId`; `array` when the field holds a list. */
type PathStep = { field: string; array: boolean };

/**
 * Every path from the renderer's declared `PageHero` type to an object with a
 * `collectionId` property, walked through the installed `dist/types/*.d.ts`
 * (named interfaces and type aliases, inline object types, arrays), so a
 * future hero field that binds a collection is fed without anyone listing it.
 */
function rendererTypeDeclarations(): string {
  const typesDir = new URL('types/', RENDERER_DIST);
  return fs
    .readdirSync(typesDir)
    .filter((f) => f.endsWith('.d.ts'))
    .map((f) => fs.readFileSync(new URL(f, typesDir), 'utf8'))
    .join('\n');
}

function heroCollectionPaths(declarationText: string, minHeroMembers: number): PathStep[][] {
  const source = declarationText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  /** The text of a balanced `{...}` starting at `open`. */
  const braced = (text: string, open: number): string => {
    let depth = 0;
    for (let i = open; i < text.length; i += 1) {
      if (text[i] === '{') depth += 1;
      else if (text[i] === '}' && (depth -= 1) === 0) return text.slice(open + 1, i);
    }
    throw new Error('unbalanced type declaration');
  };
  const declarations = new Map<string, string>();
  for (const m of source.matchAll(/export (?:interface (\w+)(?:<[^>{]*>)?(?: extends [^{]+)? \{|type (\w+)(?:<[^>=]*>)? = )/g)) {
    const name = m[1] ?? m[2];
    const at = (m.index ?? 0) + m[0].length;
    declarations.set(name, m[1] ? braced(source, at - 1) : source.slice(at, source.indexOf(';\n', at)));
  }

  /** Top-level `name?: type` members of an object body. */
  const members = (body: string): Array<[string, string]> => {
    const out: Array<[string, string]> = [];
    const flush = (text: string) => {
      const m = /^(?:readonly\s+)?["']?([\w-]+)["']?\??:\s*([\s\S]+)$/.exec(text.trim());
      if (m) out.push([m[1], m[2]]);
    };
    let depth = 0;
    let current = '';
    let previous = '';
    for (const ch of body) {
      if ('{([<'.includes(ch)) depth += 1;
      // `=>` in a function type is not a closing bracket.
      if ('})]'.includes(ch) || (ch === '>' && previous !== '=')) depth -= 1;
      previous = ch;
      if ((ch === ';' || ch === '\n' || ch === ',') && depth === 0) {
        flush(current);
        current = '';
      } else current += ch;
    }
    flush(current); // the last member of a one-line body has no terminator
    return out;
  };

  /** The top-level `{...}` bodies in a type, and the text outside them (where named types are referenced). */
  const splitTopLevel = (type: string): { inlineBodies: string[]; outside: string } => {
    const inlineBodies: string[] = [];
    let outside = '';
    for (let i = 0; i < type.length; i += 1) {
      if (type[i] === '{') {
        const body = braced(type, i);
        inlineBodies.push(body);
        i += body.length + 1;
      } else outside += type[i];
    }
    return { inlineBodies, outside };
  };

  const paths: PathStep[][] = [];
  const walk = (body: string, prefix: PathStep[], seen: Set<string>) => {
    for (const [field, type] of members(body)) {
      if (field === 'collectionId') {
        if (prefix.length > 0) paths.push(prefix);
        continue;
      }
      const array = /\[\]|Array</.test(type);
      const step = { field, array };
      // Top-level inline object types, then every named type referenced outside them.
      const { inlineBodies, outside } = splitTopLevel(type);
      for (const body of inlineBodies) walk(body, [...prefix, step], seen);
      for (const name of new Set(outside.match(/\b[A-Z]\w*\b/g) ?? [])) {
        const declared = declarations.get(name);
        if (!declared || seen.has(name)) continue;
        const inner = declared.trimStart().startsWith('{') ? braced(declared, declared.indexOf('{')) : declared;
        walk(inner, [...prefix, step], new Set([...seen, name]));
      }
    }
  };
  const hero = declarations.get('PageHero');
  assert.ok(hero && members(hero).length >= minHeroMembers, `PageHero was not parsed (${hero ? members(hero).length : 0} members)`);
  walk(hero, [], new Set(['PageHero']));
  return paths;
}

/** A hero value with `leaf` placed at the end of `path`. */
function placeAt(path: PathStep[], leaf: Record<string, unknown>): Record<string, unknown> {
  let value: unknown = leaf;
  for (const step of [...path].reverse()) value = { [step.field]: step.array ? [value] : value };
  return value as Record<string, unknown>; // built as an object at every level above
}

test('control: the type walk finds a collectionId through a named type, an array, an inline object and an alias, and nothing else', () => {
  const synthetic = [
    'export interface PageHero {',
    '    title?: string;',
    '    direct?: Direct;',
    '    listed?: Listed[];',
    '    inline?: { inner?: { collectionId?: string } };',
    '    aliased?: Aliased;',
    '    plain?: Plain;',
    '    /** collectionId mentioned only in a comment */',
    '    commented?: string;',
    '}',
    'export interface Direct { collectionId: string; select?: string; }',
    'export interface Listed { label?: string; collectionId?: string }',
    'export type Aliased = { deep?: Direct };',
    'export interface Plain { label?: string; }',
  ].join('\n');
  const found = heroCollectionPaths(synthetic, 1).map((p) => p.map((s) => s.field + (s.array ? '[]' : '')).join('.'));
  assert.deepEqual(found.sort(), ['aliased.deep', 'direct', 'inline.inner', 'listed[]']);
  assert.deepEqual(placeAt([{ field: 'listed', array: true }, { field: 'x', array: false }], { collectionId: 'c' }), { listed: [{ x: { collectionId: 'c' } }] });
});

test("COLLECTION_READING_HERO_VARIANTS is exact: the renderer's answer moves with collection data for those variants and no other", (t) => {
  const variants = rendererHeroVariants();
  assert.ok(variants.length >= 15 && variants.includes('feature-item') && variants.includes('statement'), `parsed ${variants.length} variants: ${variants}`);
  const paths = heroCollectionPaths(rendererTypeDeclarations(), 30);
  assert.ok(
    paths.some((p) => p.length === 1 && p[0].field === 'featureItem'),
    `the walk did not find hero.featureItem.collectionId; it proves nothing (found: ${JSON.stringify(paths)})`,
  );
  t.diagnostic(`${variants.length} variants; collection paths: ${paths.map((p) => p.map((s) => s.field + (s.array ? '[]' : '')).join('.')).join(', ')}`);
  const filled = { 'c-shows': [{ id: 's1', title: 'Jazz night', source: 'collection', raw: {} }] };
  const moved: string[] = [];
  for (const variant of variants) {
    // Every collection-binding field the hero type declares, with and without a designed empty state, and a partners binding.
    const heroes = paths.flatMap((path) => [
      { title: 'Live at the Hall', variant, ...placeAt(path, { collectionId: 'c-shows', select: 'first' }) },
      { title: 'Live at the Hall', variant, ...placeAt(path, { collectionId: 'c-shows', select: 'first', empty: { title: 'Nothing on' } }) },
    ]);
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
