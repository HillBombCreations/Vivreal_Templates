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
 * The layout now links the renderer's `siteFontsHref()` sheet itself.
 */

const LITERAL = { sheetFor: siteFontsHref, families: SITE_FONT_LITERAL_FAMILIES };
const BASE = siteFontsHref();

function read(relative: string): string {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  assert.ok(source.length > 200, `${relative} was not read (moved or renamed?)`);
  return source;
}

test('ALLOW: a site with no font of its own still links the literal-family sheet, Inter and Outfit included', () => {
  assert.deepEqual(siteFontStylesheets([undefined, undefined], LITERAL), [BASE]);
  assert.match(BASE, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  assert.match(BASE, /family=Inter:wght@/);
  assert.match(BASE, /family=Outfit:wght@/);
});

test('REFUSE: a per-family sheet the base already covers is not linked a second time (renderer 1.87.0 shape)', () => {
  // 1.87.0 gives a literal curated family `siteFontsHref([family])` as its own
  // googleFontsHref. The base sheet registers the same faces.
  assert.equal(SITE_FONT_LITERAL_FAMILIES.length, 7, 'parsed the wrong literal family list');
  for (const family of SITE_FONT_LITERAL_FAMILIES) {
    const own = siteFontsHref([family]);
    assert.deepEqual(siteFontStylesheets([own, own], LITERAL), [BASE], family);
  }
});

test('ALLOW: an uncurated family keeps its own sheet, after the base', () => {
  const cabin = resolveSiteFont('Cabin');
  assert.ok(cabin?.googleFontsHref, 'Cabin resolved no sheet; this test proves nothing');
  assert.deepEqual(siteFontStylesheets([cabin.googleFontsHref, undefined], LITERAL), [BASE, cabin.googleFontsHref]);
});

test('ALLOW: display and body on one uncurated family link once; two families link both', () => {
  const cabin = resolveSiteFont('Cabin')?.googleFontsHref;
  const cinzel = resolveSiteFont('Cinzel')?.googleFontsHref;
  assert.ok(cabin && cinzel && cabin !== cinzel);
  assert.deepEqual(siteFontStylesheets([cabin, cabin], LITERAL), [BASE, cabin]);
  assert.deepEqual(siteFontStylesheets([cinzel, cabin], LITERAL), [BASE, cinzel, cabin]);
});

test('the layout links the helper output with the renderer sheet, and no longer links per-site hrefs directly', () => {
  const layout = read('../../app/layout.tsx');
  assert.match(layout, /siteFontStylesheets\(\s*\[siteFont\?\.googleFontsHref, siteFontBody\?\.googleFontsHref\],\s*\{ sheetFor: siteFontsHref, families: SITE_FONT_LITERAL_FAMILIES \}/);
  assert.match(layout, /fontStylesheets\.map\(\(href\) => \(\s*<link key=\{href\} rel="stylesheet" href=\{href\} precedence="default" \/>/);
  assert.doesNotMatch(layout, /href=\{siteFont(Body)?\.googleFontsHref\}/);
});

test('REFUSE: globals.css carries no Google Fonts @import (Turbopack drops it; under webpack it would load twice)', () => {
  const css = read('../../styles/globals.css');
  assert.match(css, /@import "tailwindcss";/, 'globals.css parsed but the control import is missing');
  assert.doesNotMatch(css, /@import\s+url\(\s*['"]?https:\/\/fonts\.googleapis\.com/);
});
