import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { siteFontStylesheets } from './siteFontStylesheets.ts';
// By path, not package name: the barrel pulls `next/link` (see siteFont.test.ts).
import {
  resolveSiteFont,
  siteFontsHref,
  SITE_FONT_LITERAL_FAMILIES,
} from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/siteFont.js';

/**
 * C1, 2026-10-13: Inter and Outfit loaded on no live site because the
 * globals.css `@import` they came from is dropped by `next build --turbopack`.
 * The layout now links the renderer's `siteFontsHref()` sheet itself, on the
 * sites that draw a literal family and on no others.
 */

const LITERAL = { sheetFor: siteFontsHref, families: SITE_FONT_LITERAL_FAMILIES };
const BASE = siteFontsHref();
// The two properties Templates defines (siteFont.ts TEMPLATES_FONT_VARIABLES).
const TEMPLATES_VARS = { definedFontVariables: ['--font-geist', '--font-inter-display'] };

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 200, `${relative} was not read (moved or renamed?)`);
  return source;
}

function href(family: string): string {
  const resolved = resolveSiteFont(family);
  assert.ok(resolved?.googleFontsHref, `${family} resolved no sheet; this test proves nothing`);
  return resolved.googleFontsHref;
}

/* ── ALLOW: the base sheet is linked where a literal family is drawn ───────── */

test('ALLOW: a site with no display font (the Outfit default) links the base sheet, Inter and Outfit included', () => {
  assert.deepEqual(siteFontStylesheets({ display: null, body: null }, LITERAL), [BASE]);
  assert.match(BASE, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  assert.match(BASE, /family=Inter:wght@/);
  assert.match(BASE, /family=Outfit:wght@/);
});

test('ALLOW: the installed resolver output for Inter collapses to exactly the base sheet', () => {
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Inter') }, LITERAL), [BASE]);
});

test('ALLOW: a literal body font (Inter) under an uncurated display font links both sheets', () => {
  const cabin = href('Cabin');
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Cabin'), body: resolveSiteFont('Inter') }, LITERAL), [BASE, cabin]);
});

test('ALLOW: a typography preset links the base sheet even on a self-hosted display font', () => {
  const geist = resolveSiteFont('Geist', TEMPLATES_VARS);
  assert.deepEqual(siteFontStylesheets({ display: geist, typographyPreset: true }, LITERAL), [BASE]);
});

/* ── REFUSE: no base sheet where no literal family is drawn ────────────────── */

test('REFUSE: a self-hosted display font (Geist, Inter Display) links no sheet at all', () => {
  for (const family of ['Geist', 'Inter Display']) {
    const resolved = resolveSiteFont(family, TEMPLATES_VARS);
    assert.match(resolved?.cssValue ?? '', /^var\(/, `${family} did not resolve to a var() head; this test proves nothing`);
    assert.deepEqual(siteFontStylesheets({ display: resolved, body: null, typographyPreset: false }, LITERAL), [], family);
  }
});

test('REFUSE: uncurated display and body fonts link only their own sheets', () => {
  const cabin = href('Cabin');
  const hanken = href('Hanken Grotesk');
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Cabin') }, LITERAL), [cabin]);
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Cabin'), body: resolveSiteFont('Hanken Grotesk') }, LITERAL), [cabin, hanken]);
});

test('REFUSE: a per-family sheet the base already covers is not linked a second time (renderer 1.87.0 shape)', () => {
  // 1.87.0 gives a literal curated family `siteFontsHref([family])` as its own
  // googleFontsHref. The base sheet registers the same faces.
  assert.equal(SITE_FONT_LITERAL_FAMILIES.length, 7, 'parsed the wrong literal family list');
  for (const family of SITE_FONT_LITERAL_FAMILIES) {
    const own = { cssValue: `'${family}', sans-serif`, googleFontsHref: siteFontsHref([family]) };
    assert.deepEqual(siteFontStylesheets({ display: own, body: own }, LITERAL), [BASE], family);
  }
});

test('ALLOW: display and body on one uncurated family link once', () => {
  const cabin = href('Cabin');
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Cabin'), body: resolveSiteFont('Cabin') }, LITERAL), [cabin]);
});

/* ── the layout wiring ─────────────────────────────────────────────────────── */

test('the layout links the helper output, preconnects only when it is non-empty, and links no per-site href directly', () => {
  const layout = read('../../app/layout.tsx');
  assert.match(layout, /siteFontStylesheets\(\s*\{\s*display: siteFont,\s*body: siteFontBody,\s*typographyPreset:/);
  assert.match(layout, /\{ sheetFor: siteFontsHref, families: SITE_FONT_LITERAL_FAMILIES \}/);
  assert.match(layout, /fontStylesheets\.map\(\(href\) => \(\s*<link key=\{href\} rel="stylesheet" href=\{href\} precedence="default" \/>/);
  assert.doesNotMatch(layout, /href=\{siteFont(Body)?\.googleFontsHref\}/);
  // ALLOW: both preconnects sit inside the non-empty guard.
  assert.match(
    layout,
    /\{fontStylesheets\.length > 0 && \(\s*<>\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com" \/>\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossOrigin="" \/>\s*<\/>\s*\)\}/,
  );
  // REFUSE: no preconnect anywhere else, so a site with no sheet opens no font origin.
  assert.equal(layout.match(/rel="preconnect"/g)?.length, 2);
});

test('REFUSE: globals.css carries no Google Fonts @import (Turbopack drops it; under webpack it would load twice)', () => {
  const css = read('../../styles/globals.css');
  assert.match(css, /@import "tailwindcss";/, 'globals.css parsed but the control import is missing');
  assert.doesNotMatch(css, /@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis\.com/);
});

/* ── Owner find 3: the monospace sheet ─────────────────────────────────────── */

const PACK_MONO = "'JetBrains Mono', ui-monospace, monospace";

test('ALLOW (find 3): a site whose mono is JetBrains Mono requests the JetBrains Mono sheet', () => {
  const sheets = siteFontStylesheets({ display: null, body: null, mono: PACK_MONO }, LITERAL);
  assert.equal(sheets[0], BASE, 'the base sheet moved; the mono sheet must be appended, not replace it');
  const mono = sheets.filter((s) => s.includes('family=JetBrains+Mono'));
  assert.equal(mono.length, 1, JSON.stringify(sheets));
  assert.doesNotMatch(BASE, /JetBrains/, 'the base sheet grew a mono family; the separate sheet proves nothing');
  // Also on a self-hosted display face, which links no base sheet.
  const geist = resolveSiteFont('Geist', TEMPLATES_VARS);
  assert.deepEqual(siteFontStylesheets({ display: geist, mono: PACK_MONO }, LITERAL), mono);
});

test('REFUSE (find 3): an uncurated mono head requests no sheet and does not throw; no mono is today\'s list', () => {
  for (const mono of ['Menlo, monospace', 'ui-monospace, monospace', "var(--font-geist-mono), monospace", '', null, undefined]) {
    assert.deepEqual(siteFontStylesheets({ display: null, body: null, mono }, LITERAL), [BASE], String(mono));
  }
  const cabin = href('Cabin');
  assert.deepEqual(siteFontStylesheets({ display: resolveSiteFont('Cabin'), mono: 'Menlo' }, LITERAL), [cabin]);
});

test('the layout feeds the mono by the builder\'s own rule', () => {
  const layout = read('../../app/layout.tsx');
  assert.match(layout, /mono: resolveMonoFamily\(siteData as unknown as Record<string, unknown>\),/);
  assert.match(layout, /import \{ resolveMonoFamily \} from '@hillbombcreations\/site-renderer\/theme';/);
});
