import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// The renderer's compiled font resolver, imported by PATH rather than by
// package name: the package barrel pulls `next/link`, which plain Node cannot
// resolve outside a Next build. This module has no imports beyond the
// renderer's own token constants, so it loads standalone.
//
// `siteFont.ts` itself cannot be imported here at all — it calls
// `next/font/google` and `next/font/local` at module scope, which only Next's
// SWC loader can evaluate. So this file asserts the two halves separately: the
// resolver's OUTPUT, called exactly as siteFont.ts calls it, and the SOURCE of
// siteFont.ts, to prove that is in fact how it calls it.
import {
  resolveSiteFont,
  SANS_FALLBACK,
  SERIF_FALLBACK,
} from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/siteFont.js';

/**
 * Wave 4, audit D1: one typeface resolver, shared with the Studio preview.
 *
 * The table, the normalization, the fallback chains, the arbitrary-family
 * branch and the Google Fonts URL used to live in `src/lib/fonts/siteFont.ts`.
 * The portal hand-ported all of it into `lib/sites/previewSiteFont.ts` for Wave
 * 1 and guarded the port with a cross-repo test that read THIS repo's source
 * off a sibling checkout on disk. Three copies of a pure function, one of them
 * policed by a test that silently skipped whenever the sibling checkout was
 * absent.
 *
 * The convergence is only adoptable if it is byte-identical to what these sites
 * serve today, and "byte-identical" is a claim, not a design goal, so the nine
 * curated strings below are asserted rather than assumed. The load-bearing
 * detail is `definedFontVariables`: a `var()` head is correct ONLY for a
 * surface that defines the property, and an unresolvable `var()` invalidates
 * the whole `font-family` declaration at computed-value time, so the element
 * inherits. Templates defines two properties, the studio frame defines a
 * different two, and passing the wrong list is precisely the D1 bug.
 */

const SITE_FONT_SOURCE = '../../lib/fonts/siteFont.ts';

function readSource(): string {
  const source = fs.readFileSync(new URL(SITE_FONT_SOURCE, import.meta.url), 'utf8');
  assert.ok(source.length > 500, 'siteFont.ts was not read (moved or renamed?)');
  return source;
}

/**
 * The properties Templates declares, read out of the source rather than
 * restated, so every byte-parity assertion below is made with the list the app
 * actually passes.
 */
function templatesFontVariables(): string[] {
  const source = readSource();
  const declared = /TEMPLATES_FONT_VARIABLES: readonly string\[\] = \[([^\]]*)\]/.exec(source);
  assert.ok(declared, 'TEMPLATES_FONT_VARIABLES moved; this test parsed nothing');
  const vars = [...declared[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  // Vacuity guard: an empty list silently turns every `var()` assertion below
  // into a literal-stack assertion, which is the failure mode this whole file
  // exists to catch.
  assert.equal(vars.length, 2, `parsed ${vars.length} font variables, expected 2`);
  return vars;
}

const resolve = (family: string | null | undefined) =>
  resolveSiteFont(family, { definedFontVariables: templatesFontVariables() });

/* ── the delegation is real ────────────────────────────────────────────────── */

test('siteFont.ts resolves through the renderer and keeps no table of its own', () => {
  const source = readSource();
  assert.match(
    source,
    /import\s*\{[^}]*resolveSiteFont as resolveSharedSiteFont[^}]*\}\s*from\s*'@hillbombcreations\/site-renderer'/,
    'the shared resolver must be the one that decides',
  );
  assert.ok(
    !/const CURATED_FONTS/.test(source),
    'the curated table is the renderer\'s now; a local copy is the drift this wave removes',
  );
  assert.ok(
    !/fonts\.googleapis\.com/.test(source),
    'the arbitrary-family Google Fonts URL is built by the shared resolver',
  );
  assert.match(
    source,
    /definedFontVariables:\s*TEMPLATES_FONT_VARIABLES/,
    'the resolver must be told which custom properties this app defines',
  );
});

test('the two next/font calls stay here, because only Next can evaluate them', () => {
  // The SWC font loader analyses these statically at build time, `next` is only
  // a peer dependency of the renderer, and the className each returns is hashed
  // per build. That is why the renderer returns a property NAME and this file
  // maps it to a class.
  const source = readSource();
  assert.match(source, /from 'next\/font\/google'/);
  assert.match(source, /from 'next\/font\/local'/);
  assert.match(source, /variable: '--font-geist'/);
  assert.match(source, /variable: '--font-inter-display'/);
  assert.match(
    source,
    /FONT_VARIABLE_CLASSNAMES[\s\S]{0,200}'--font-geist':\s*geistFont\.variable/,
    'the property the resolver picks must map back to this app\'s hashed className',
  );
  assert.match(
    source,
    /'--font-inter-display':\s*interDisplayFont\.variable/,
  );
});

test('the declared properties and the className map name the same two properties', () => {
  const source = readSource();
  const mapBlock = /const FONT_VARIABLE_CLASSNAMES[^{]*\{([\s\S]*?)\n\};/.exec(source);
  assert.ok(mapBlock, 'FONT_VARIABLE_CLASSNAMES moved; this test parsed nothing');
  const mapped = [...mapBlock[1].matchAll(/'(--[a-z-]+)':/g)].map((m) => m[1]).sort();
  assert.equal(mapped.length, 2, `parsed ${mapped.length} mapped properties, expected 2`);
  assert.deepEqual(
    mapped,
    [...templatesFontVariables()].sort(),
    'a property the resolver is told about but cannot be mapped back to a className ' +
      'emits a var() head with nothing behind it, and the element inherits',
  );
});

/* ── byte parity with what these sites serve today ─────────────────────────── */

test('the nine curated families resolve to the exact strings Templates serves', () => {
  const expected: Record<string, string> = {
    Outfit: `'Outfit', ${SANS_FALLBACK}`,
    Inter: `'Inter', ${SANS_FALLBACK}`,
    Fraunces: `'Fraunces', ${SERIF_FALLBACK}`,
    'Space Grotesk': `'Space Grotesk', ${SANS_FALLBACK}`,
    'Playfair Display': `'Playfair Display', ${SERIF_FALLBACK}`,
    'DM Sans': `'DM Sans', ${SANS_FALLBACK}`,
    Sora: `'Sora', ${SANS_FALLBACK}`,
    // The two with a next/font call behind them, and the only two that get a
    // var() head. vivreal.io is the Geist row: the live <body> carries exactly
    // this string today.
    Geist: `var(--font-geist), 'Geist', ${SANS_FALLBACK}`,
    'Inter Display': `var(--font-inter-display), 'Inter Display', 'Inter', ${SANS_FALLBACK}`,
  };
  assert.equal(Object.keys(expected).length, 9, 'the curated table lost an entry');
  for (const [family, cssValue] of Object.entries(expected)) {
    assert.equal(resolve(family)?.cssValue, cssValue, `resolved value drifted for "${family}"`);
  }
});

test('normalization is case- and separator-insensitive, as the migrator capture needs', () => {
  const canonical = resolve('Space Grotesk')?.cssValue;
  assert.ok(canonical, 'the canonical spelling resolved to nothing');
  for (const spelling of ['space grotesk', 'space-grotesk', 'SpaceGrotesk', '  Space  Grotesk ']) {
    assert.equal(resolve(spelling)?.cssValue, canonical, `"${spelling}" did not normalize`);
  }
});

test('only the two next/font families carry a fontVariable, and it is the right one', () => {
  assert.equal(resolve('Geist')?.fontVariable, '--font-geist');
  assert.equal(resolve('Inter Display')?.fontVariable, '--font-inter-display');
  // Outfit has a fontVariable in the renderer's table because the STUDIO FRAME
  // defines --font-outfit. Templates does not, so it must resolve to the
  // literal stack with no var() head, exactly as it does live today.
  assert.equal(resolve('Outfit')?.fontVariable, undefined);
  assert.equal(resolve('Inter')?.fontVariable, undefined);
});

test('an uncurated family gets the literal name plus a Google Fonts stylesheet', () => {
  // Three of the four fleet sites that set fontFamily land here (Cabin twice,
  // Cinzel), so this is the common path, not the exotic one.
  // Since renderer 1.72.0 the href carries the resolver's DEFAULT_FONT_WEIGHTS
  // when a site declares none, so an uncurated family gets real bold instead of a
  // single 400 face. The declared-weights path is pinned separately.
  const cabin = resolve('Cabin');
  assert.equal(cabin?.cssValue, `'Cabin', ${SANS_FALLBACK}`);
  assert.equal(cabin?.googleFontsHref, 'https://fonts.googleapis.com/css2?family=Cabin:wght@300;400;500;600;700;800;900&display=swap');
  assert.equal(cabin?.fontVariable, undefined);
  assert.equal(
    resolve('Libre Baskerville')?.googleFontsHref,
    'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@300;400;500;600;700;800;900&display=swap',
  );
});

test('a captured name carrying quotes or backslashes cannot break out of the CSS value', () => {
  const nasty = resolve(`Ev"il\\`);
  assert.equal(nasty?.cssValue, `'Evil', ${SANS_FALLBACK}`);
  assert.ok(!nasty?.cssValue.includes('"'));
  assert.ok(!nasty?.cssValue.includes('\\'));
});

test('absent or blank resolves to null, which is what keeps every other site unchanged', () => {
  // The root layout renders NO className, NO inline style and NO <link> on
  // null. That is what makes a site with no captured font byte-identical to the
  // hardcoded Outfit default in globals.css.
  for (const empty of [undefined, null, '', '   ']) {
    assert.equal(resolve(empty as string | null | undefined), null, `"${String(empty)}" should resolve to null`);
  }
  assert.equal(resolve(42 as unknown as string), null, 'a non-string must not throw');
});

/* ── Storefront Phase 0.7: weights a site declares (Contract 3) ──────────── */

test('Phase 0.7: the adapter hands the declared weights to the shared resolver', () => {
  const source = readSource();
  assert.match(source, /export function resolveSiteFont\(fontFamily\?: string \| null, fontWeights\?: unknown\): SiteFontResolution \| null/);
  assert.match(source, /resolveSharedSiteFont\(fontFamily, \{\s*definedFontVariables: TEMPLATES_FONT_VARIABLES,\s*fontWeights,\s*\}\)/);
});

test('Phase 0.7: the root layout passes siteData.fontWeights to both font calls', () => {
  const layout = fs.readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8');
  assert.ok(layout.includes('resolveSiteFont('), 'read the real layout');
  assert.match(layout, /resolveSiteFont\(siteData\.fontFamily, siteData\.fontWeights\)/);
  assert.match(layout, /resolveSiteFont\(\(siteData as \{ fontFamilyBody\?: string \| null \}\)\.fontFamilyBody, siteData\.fontWeights\)/);
});

test('Phase 0.7: called the way the adapter calls it, declared weights narrow the request and absent ones get the default weights', () => {
  const declared = resolveSiteFont('Cinzel', { definedFontVariables: templatesFontVariables(), fontWeights: [700, 400] });
  assert.equal(declared?.googleFontsHref, 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap');
  const absent = resolveSiteFont('Cabin', { definedFontVariables: templatesFontVariables(), fontWeights: undefined });
  assert.equal(absent?.googleFontsHref, 'https://fonts.googleapis.com/css2?family=Cabin:wght@300;400;500;600;700;800;900&display=swap');
});
