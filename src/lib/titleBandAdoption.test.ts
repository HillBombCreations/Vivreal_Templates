import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// The renderer's compiled titleBand module, imported by PATH rather than by
// package name. The package barrel cannot be loaded under plain Node: it pulls
// `next/link` through NextSiteRendererProvider, and Node's resolver rejects
// that extensionless specifier outside a Next build. This module imports only
// types, so it loads standalone. Every assertion below that uses it is preceded
// by a guard that the import actually produced functions, so a moved dist path
// fails loudly instead of passing on nothing.
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TitleBand,
  shouldRenderTitleBand,
  willRenderHeroBanner,
  hasHomeSectionBlock,
  GENERIC_TITLE_BAND_FORMATS,
} from '../../node_modules/@hillbombcreations/site-renderer/dist/composition/titleBand.js';

/**
 * Wave 4 (audit D9): the transitional title band has ONE implementation, and it
 * is the renderer's.
 *
 * It used to have three definitions of one condition — `lib/heroBanner.ts` plus
 * a spelled-out gate in each of the two page wrappers — and two copies of the
 * markup, in `renderComposedPage.tsx` and `app/[slug]/page.tsx`. Every copy
 * carried a comment asking the next person to keep it in step. They drifted
 * twice: /studio-demo printed "Build a site in under 60 seconds" once bare and
 * once inside the synthetic banner, and the dark-chrome band that
 * renderComposedPage grew never reached the [slug] copy.
 *
 * The cost that mattered was not the duplication, it was the SURFACE: the band
 * was Templates JSX, so the Studio preview rendered no page heading at all. A
 * page title that exists at the URL and not in the editor.
 *
 * Two halves to this file, and both are needed:
 *   - source reads proving the duplicates are gone and the renderer is what
 *     these two files call (a behaviour test cannot see a second copy sitting
 *     unused, and these are `server-only` .tsx files that plain Node cannot
 *     load, the same tradeoff `chromePreviewParity.test.ts` documents);
 *   - behaviour assertions on the imported gate, over the same case matrix the
 *     deleted `heroBanner.test.ts` covered, so "we import it" also means "what
 *     we import still decides what our band decided".
 */

const SOURCES = {
  renderComposedPage: '../lib/renderComposedPage.tsx',
  slugPage: '../app/[slug]/page.tsx',
} as const;

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 500, `${relative} was not read (moved or renamed?)`);
  return source;
}

/**
 * Comments in these files DISCUSS the seams they must not take, at length. A
 * negative assertion that reads prose as code is a false positive waiting to
 * happen, so strip comments before asserting an absence.
 */
function code(relative: string): string {
  const stripped = read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(stripped.length > 500, `${relative} is all comment after stripping?`);
  return stripped;
}

/* ── the duplicates are gone ───────────────────────────────────────────────── */

test('lib/heroBanner.ts is deleted, and nothing under src/ still imports it', () => {
  assert.equal(
    fs.existsSync(new URL('./heroBanner.ts', import.meta.url)),
    false,
    'heroBanner.ts must not come back: willRenderHeroBanner and hasHomeSectionBlock are ' +
      'exported from the renderer, and mapBlocks CALLS the same willRenderHeroBanner, ' +
      'so the three-way drift that double-printed /studio-demo ends there',
  );

  // Walk src/ rather than trusting a fixed file list: a new importer is exactly
  // the regression this guards.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const offenders: string[] = [];
  let scanned = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(child);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue;
      scanned += 1;
      // The import SPECIFIER, not the word: this file discusses heroBanner by
      // name and would otherwise report itself.
      if (/from\s*["'][^"']*heroBanner/.test(fs.readFileSync(child, 'utf8'))) {
        offenders.push(path.relative(root, child));
      }
    }
  };
  walk(root);
  // Vacuity guard: an empty walk would make the assertion below meaningless.
  assert.ok(scanned > 200, `expected to scan the whole of src/, scanned ${scanned} files`);
  assert.deepEqual(offenders, [], 'these files still reference the deleted heroBanner module');
});

test('neither page wrapper carries the band markup any more', () => {
  // The two literals below are the band's own markup, one per chrome mode.
  // Matching on them rather than on formatting is what makes a reformat safe
  // and a re-inlined copy fatal.
  const LIGHT_BAND = 'content-grid pt-28 pb-0';
  const DARK_BAND = 'content-grid pt-32 pb-16 text-center';
  for (const [name, relative] of Object.entries(SOURCES)) {
    const source = code(relative);
    assert.ok(
      !source.includes(LIGHT_BAND),
      `${name} still inlines the light-chrome band; it belongs to the renderer's TitleBand`,
    );
    assert.ok(
      !source.includes(DARK_BAND),
      `${name} still inlines the dark-chrome band; it belongs to the renderer's TitleBand`,
    );
  }
});

test('both page wrappers take the band and its gate from the renderer', () => {
  for (const [name, relative] of Object.entries(SOURCES)) {
    const source = read(relative);
    for (const symbol of ['TitleBand', 'shouldRenderTitleBand']) {
      assert.match(
        source,
        new RegExp(`import\\s*\\{[^}]*\\b${symbol}\\b[^}]*\\}\\s*from\\s*["']@hillbombcreations/site-renderer["']`),
        `${name} must import ${symbol} from the renderer`,
      );
    }
    assert.match(
      source,
      /<TitleBand\b/,
      `${name} must mount the renderer's band, not its own`,
    );
  }
});

test('renderComposedPage still owns the mount point, so it still passes suppressSrTitle', () => {
  // The renderer offers a second seam, `options.titleBand: true`, which renders
  // the band INSIDE composePage. This route must not take it: the band being
  // synchronous outside the Suspense boundary is what puts the real heading on
  // screen before the collection fetches resolve. Owning the mount point is
  // what obliges this file to suppress composePage's sr-only h1 — do both and
  // the page has two h1s, do neither and it has none that a sighted visitor
  // can see.
  const source = code(SOURCES.renderComposedPage);
  assert.match(source, /suppressSrTitle=\{showTransitionalTitleBand\}/);
  assert.ok(
    !/titleBand:\s*true/.test(source),
    'renderComposedPage must not ALSO ask composePage to render the band',
  );
});

/* ── what we import still decides what our band decided ────────────────────── */

type BandPage = Parameters<typeof shouldRenderTitleBand>[0];

function page(o: Record<string, unknown> = {}): BandPage {
  return { format: 'standard', labels: {}, blocks: [], ...o } as BandPage;
}

const heroBlock = (dispatchId: string) => ({
  id: 'h',
  order: 0,
  enabled: true,
  type: { kind: 'home-section', dispatchId },
  config: {},
});

test('the imported module is the real thing (guards every assertion below)', () => {
  for (const [name, fn] of Object.entries({
    shouldRenderTitleBand,
    willRenderHeroBanner,
    hasHomeSectionBlock,
  })) {
    assert.equal(typeof fn, 'function', `${name} did not come across from the renderer dist`);
  }
  // Templates keeps its OWN generic set for the isEmpty -> notFound() guard,
  // which is a different concern from the band and stays here. It is still the
  // same three formats, and the band is only right if the two agree, so the set
  // is read out of the source and compared rather than restated.
  const source = read(SOURCES.renderComposedPage);
  const declared = /const GENERIC_FORMATS = new Set\(\[([^\]]*)\]\)/.exec(source);
  assert.ok(declared, "renderComposedPage's GENERIC_FORMATS declaration moved; this test read nothing");
  const templatesFormats = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  assert.equal(templatesFormats.length, 3, `parsed ${templatesFormats.length} formats, expected 3`);
  assert.deepEqual(
    [...GENERIC_TITLE_BAND_FORMATS].sort(),
    templatesFormats,
    "the renderer's generic set drifted from Templates' GENERIC_FORMATS",
  );
});

test('shouldRenderTitleBand: the ordinary generic page with a title renders the band', () => {
  assert.equal(shouldRenderTitleBand(page({ labels: { title: 'About us' } })), true);
  assert.equal(shouldRenderTitleBand(page({ format: 'list', labels: { title: 'News' } })), true);
  assert.equal(shouldRenderTitleBand(page({ format: 'grid', labels: { title: 'Work' } })), true);
});

test('shouldRenderTitleBand: a non-generic format renders no band', () => {
  // products/shows/menu/... all render their own masthead.
  assert.equal(shouldRenderTitleBand(page({ format: 'products', labels: { title: 'Shop' } })), false);
  assert.equal(shouldRenderTitleBand(page({ format: 'form', labels: { title: 'Contact' } })), false);
});

test('shouldRenderTitleBand: no authored title, no band', () => {
  assert.equal(shouldRenderTitleBand(page()), false);
  assert.equal(shouldRenderTitleBand(page({ labels: { title: '   ' } })), false);
});

test('shouldRenderTitleBand: a section-header block owns the heading (B-author model)', () => {
  const p = page({
    labels: { title: 'About us' },
    blocks: [{ id: 's', order: 0, enabled: true, type: { kind: 'static', dispatchId: 'section-header' }, config: {} }],
  });
  assert.equal(shouldRenderTitleBand(p), false);
});

test('shouldRenderTitleBand: a home-section hero owns the heading (Gate-2 masthead dedupe)', () => {
  // The bare band above a masthead would double-title AND push the 100svh
  // hero below the fold.
  const p = page({ labels: { title: 'Weddings' }, blocks: [heroBlock('hero')] });
  assert.equal(shouldRenderTitleBand(p), false);
  assert.equal(hasHomeSectionBlock(p), true);
  assert.equal(hasHomeSectionBlock(page({ labels: { title: 'Weddings' } })), false);
});

test('shouldRenderTitleBand: the synthetic hero banner owns the heading (/studio-demo)', () => {
  // The 2026-07-10 double-title bug, pinned. buttonLabel + buttonLink make
  // mapBlocks emit a kind:'banner' section that renders this same title with
  // its subtitle and button; the bare band above it printed the title twice.
  const studioDemo = page({
    labels: {
      title: 'Build a site in under 60 seconds',
      subtitle: 'No signup. No commitment. Edit a real Studio in your browser.',
      buttonLabel: 'Try the Studio',
      buttonLink: 'https://vivreal.io/app/studio-demo',
    },
  });
  assert.equal(willRenderHeroBanner(studioDemo), true);
  assert.equal(shouldRenderTitleBand(studioDemo), false);
});

test('willRenderHeroBanner: one half of the button pair is not a banner', () => {
  const base = { title: 'About us' };
  assert.equal(willRenderHeroBanner(page({ labels: base })), false);
  assert.equal(willRenderHeroBanner(page({ labels: { ...base, buttonLabel: 'Learn more' } })), false);
  assert.equal(willRenderHeroBanner(page({ labels: { ...base, buttonLink: '/contact' } })), false);
  assert.equal(
    willRenderHeroBanner(page({ labels: { ...base, buttonLabel: '   ', buttonLink: '   ' } })),
    false,
  );
  // So the band still renders for all of those: this is the "today's ordinary
  // standard page" case, and it is the one that must not regress.
  assert.equal(shouldRenderTitleBand(page({ labels: base })), true);
});

test('willRenderHeroBanner: a home-section hero suppresses the synthetic banner too', () => {
  const p = page({
    labels: { title: 'Acme', buttonLabel: 'Go', buttonLink: '/go' },
    blocks: [heroBlock('hero')],
  });
  assert.equal(willRenderHeroBanner(p), false);
});

test('neither gate throws on a page with no labels and no blocks', () => {
  assert.equal(willRenderHeroBanner({} as BandPage), false);
  assert.equal(hasHomeSectionBlock({} as BandPage), false);
  assert.equal(shouldRenderTitleBand({} as BandPage), false);
});

test("the form-page arm the renderer added cannot reach Templates' band", () => {
  // The renderer's willRenderHeroBanner grew a third arm: a `form` page with a
  // title gets the synthetic banner, because FormLayout never renders
  // page.labels and vivreal.io/contact was silently dropping its H1. Templates'
  // deleted copy had no such arm, so this is the one behavioural difference the
  // adoption brings in. It cannot touch the band: `form` is not a generic
  // format, so shouldRenderTitleBand returns false on the format clause first,
  // exactly as it did before.
  const contact = page({ format: 'form', labels: { title: 'Get in Touch' } });
  assert.equal(willRenderHeroBanner(contact), true);
  assert.equal(shouldRenderTitleBand(contact), false);
});

/* ── the band paints the same bytes it painted here ────────────────────────── */

/**
 * The markup below is what `renderComposedPage.tsx` emitted before this wave,
 * rendered out of the version-controlled JSX it carried. Every class, every
 * custom property and every fallback colour is transcribed from that file. A
 * site that renders the band today must keep rendering exactly this, or the
 * adoption is not a refactor.
 */
const LIGHT_HTML =
  '<div class="content-grid pt-28 pb-0">' +
  '<header class="mb-8">' +
  '<h1 class="text-3xl md:text-4xl font-bold tracking-tight" style="color:var(--text-primary)">About us</h1>' +
  '<p class="mt-2 text-lg text-muted-foreground">Who we are</p>' +
  '</header></div>';

/*
 * DELIBERATE DIVERGENCE FROM THE ORIGINAL MIGRATION SNAPSHOT, 2026-09-09.
 *
 * The dark ground used to be `var(--surface-alt, #1a1a2e)`. That was a defect,
 * not a style: `--surface-alt` is a CONTENT-PANEL token that four of the six
 * palette presets author LIGHT, and a `var()` fallback only applies when the
 * property is UNSET, so the dark literal never once rescued a real site.
 * Measured on help.vivreal.io, whose `--surface-alt` is #eeeff0: white
 * `--text-inverse` over that ground is 1.15:1 against a 4.5 floor, on all 60
 * article pages.
 *
 * The parity CLAIM this file makes is unchanged and still enforced -- Templates
 * paints exactly what the renderer paints, byte for byte. Only the bytes moved,
 * and they moved because the renderer fixed the band. See
 * `composition/titleBand.tsx` for the fleet law ("a dark band must never read
 * --surface-alt") this restores.
 */
const DARK_HTML =
  '<div style="background:linear-gradient(135deg, #0f1729, ' +
  'color-mix(in srgb, #0f1729 88%, var(--primary, #111)))">' +
  '<div class="content-grid pt-32 pb-16 text-center">' +
  '<h1 class="text-3xl md:text-5xl font-bold tracking-tight" ' +
  'style="color:var(--text-inverse, #ffffff);font-family:var(--font-display)">About us</h1>' +
  '<p class="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed" ' +
  'style="color:color-mix(in srgb, var(--text-inverse, #fff) 70%, transparent)">Who we are</p>' +
  '</div></div>';

const bandPage = { labels: { title: 'About us', subtitle: 'Who we are' } };

test("the renderer's light-chrome band is byte-identical to the one this file used to paint", () => {
  const html = renderToStaticMarkup(TitleBand({ page: bandPage }));
  assert.ok(html.length > 100, 'TitleBand rendered nothing; the rest of this test would be vacuous');
  assert.equal(html, LIGHT_HTML);
});

test("the renderer's dark-chrome band is byte-identical too", () => {
  const html = renderToStaticMarkup(TitleBand({ page: bandPage, chrome: 'dark' }));
  assert.ok(html.length > 100, 'TitleBand rendered nothing; the rest of this test would be vacuous');
  assert.equal(html, DARK_HTML);
});

test('the band drops the subtitle paragraph when there is no subtitle, and renders nothing without a title', () => {
  const noSubtitle = renderToStaticMarkup(
    TitleBand({ page: { labels: { title: 'About us' } } }),
  );
  assert.match(noSubtitle, /About us/);
  assert.ok(!noSubtitle.includes('<p'), 'an absent subtitle must not leave an empty paragraph');
  assert.equal(renderToStaticMarkup(TitleBand({ page: { labels: {} } })), '');
});
