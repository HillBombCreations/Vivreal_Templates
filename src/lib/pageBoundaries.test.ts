/**
 * F323 (release C, T-323-2; vivreal-hq docs/projects/next-release-C/
 * design-home-pages.md 4.3 and 5): pages are sent complete.
 *
 * A page-authored `<Suspense>` box around a page body made every home page
 * reach readers that run no scripts (search engines, link previews) as a grey
 * box with the whole body hidden, and turned any guard inside it into a soft
 * 200. This scan refuses a box on the page routes, caps the boxes left in the
 * app at the allowlist, and pins the two hook callers that may lean on one.
 *
 * Comment-stripped source scans, like `darkRenderedHero.test.ts`'s `code()`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Drop block comments (JSX `{/* *\/}` included) and line comments. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function countBoxes(source: string): number {
  return (code(source).match(/<Suspense\b/g) ?? []).length;
}

function importsSuspense(source: string): boolean {
  return /import\s*\{[^}]*\bSuspense\b[^}]*\}\s*from\s*["']react["']/.test(code(source));
}

const SHOP_COMPONENT_IMPORT = /from\s*["'][^"']*\/(?:ProductsPageComposed|CoordinatedProductsComposed)(?:\/index)?(?:\.tsx?)?["']/;

function importsShopComponent(source: string): boolean {
  return SHOP_COMPONENT_IMPORT.test(code(source));
}

function callsUseSearchParams(source: string): boolean {
  return /\buseSearchParams\(/.test(code(source));
}

/** Every source file under src, as a posix path relative to the repo root, tests excluded. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__testing__' || entry.name === 'testSupport') continue;
        walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        out.push(path.relative(path.dirname(SRC), full).split(path.sep).join('/'));
      }
    }
  };
  walk(SRC);
  return out;
}

const read = (rel: string): string => fs.readFileSync(path.join(path.dirname(SRC), rel), 'utf8');

const PAGE_ROUTES = [
  'src/app/page.tsx',
  'src/app/[slug]/page.tsx',
  'src/app/[slug]/[itemId]/page.tsx',
  'src/app/[...segments]/page.tsx',
  'src/lib/renderComposedPage.tsx',
];

/** The boxes left in the app: the progress bar, and the two shop section boxes. */
const BOX_ALLOWLIST: Record<string, number> = {
  'src/app/layout.tsx': 1,
  'src/components/PageTemplates/liveProductsOverrides.tsx': 2,
};

const OVERRIDES = 'src/components/PageTemplates/liveProductsOverrides';

const SEARCH_PARAMS_CALLERS = new Set([
  'src/components/Navigation/RouteProgress.tsx',
  'src/components/PageTemplates/useProductsLiveAdapters.ts',
]);

test('CONTROL: the scanner counts a box in code and not in a comment', () => {
  assert.equal(countBoxes('const a = <Suspense fallback={<X />}><Y /></Suspense>;'), 1);
  assert.equal(countBoxes('// <Suspense fallback={<X />}>\n/* <Suspense> */\nconst a = 1;'), 0);
  assert.equal(countBoxes('{/* <Suspense fallback={null}> */}'), 0);
  assert.equal(importsSuspense('import { Suspense } from "react";'), true);
  assert.equal(importsSuspense('// import { Suspense } from "react";'), false);
});

test('REFUSE: no page route holds a box or imports Suspense', () => {
  for (const rel of PAGE_ROUTES) {
    const source = read(rel);
    assert.equal(countBoxes(source), 0, `${rel} holds a <Suspense> box: the page would reach readers without scripts hidden`);
    assert.equal(importsSuspense(source), false, `${rel} imports Suspense`);
  }
});

test('REFUSE: no file holds more boxes than the allowlist', () => {
  const over: string[] = [];
  for (const rel of sourceFiles()) {
    if (!rel.endsWith('.tsx')) continue;
    const n = countBoxes(read(rel));
    if (n > (BOX_ALLOWLIST[rel] ?? 0)) over.push(`${rel}: ${n}`);
  }
  assert.deepEqual(over, [], 'a new box needs its reason and an allowlist line here');
});

test('REFUSE: no loading.tsx or loading.ts under src/app (one would box every page again)', () => {
  const found = sourceFiles().filter((rel) => rel.startsWith('src/app/') && /\/loading\.tsx?$/.test(rel));
  assert.deepEqual(found, []);
});

test('ALLOW: the layout keeps exactly one box, around the progress bar alone', () => {
  const layout = code(read('src/app/layout.tsx'));
  assert.equal(countBoxes(layout), 1);
  assert.match(layout, /<Suspense fallback=\{null\}>\s*<RouteProgress \/>\s*<\/Suspense>/);
});

test('ALLOW: the shop overrides file is .tsx and holds exactly the two shop section boxes', () => {
  const rel = `${OVERRIDES}.tsx`;
  assert.ok(fs.existsSync(path.join(path.dirname(SRC), rel)), `${rel} must exist (the boxes need JSX)`);
  const source = code(read(rel));
  assert.equal(countBoxes(source), 2);
  assert.match(source, /<Suspense fallback=\{null\}>\s*<ProductsPageComposed \{\.\.\.p\} \/>\s*<\/Suspense>/);
  assert.match(source, /<Suspense fallback=\{null\}>\s*<CoordinatedProductsComposed \{\.\.\.p\} \/>\s*<\/Suspense>/);
});

test('CONTROL: the shop import scan counts a planted import and not one in a comment', () => {
  assert.equal(importsShopComponent('import P from "@/components/PageTemplates/ProductsPageComposed";'), true);
  assert.equal(importsShopComponent("import C from '../CoordinatedProductsComposed/index.tsx';"), true);
  assert.equal(importsShopComponent('// import P from "@/components/PageTemplates/ProductsPageComposed";'), false);
});

test('REFUSE: only the overrides file imports the shop section components (anywhere else draws them with no box above their hook)', () => {
  const importers = sourceFiles().filter(
    (rel) => rel.replace(/\.tsx?$/, '') !== OVERRIDES && importsShopComponent(read(rel)),
  );
  assert.deepEqual(importers, []);
});

test('CONTROL: the hook scan counts a planted call and not one in a comment', () => {
  assert.equal(callsUseSearchParams('const sp = useSearchParams();'), true);
  assert.equal(callsUseSearchParams('// const sp = useSearchParams();'), false);
});

test('REFUSE: no new useSearchParams() caller (a new caller needs its own box and its own line here)', () => {
  const callers = sourceFiles().filter((rel) => callsUseSearchParams(read(rel)));
  assert.deepEqual(callers.filter((rel) => !SEARCH_PARAMS_CALLERS.has(rel)), [],
    'a new useSearchParams() caller needs its own <Suspense> box and its own allowlist line in this test');
  for (const rel of SEARCH_PARAMS_CALLERS) assert.ok(callers.includes(rel), `${rel} still calls useSearchParams()`);
});
