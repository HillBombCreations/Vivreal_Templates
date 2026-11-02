import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { FunctionComponent } from 'react';

// Renderer 1.85.0 review, C5: the footer contrast fix, the footer and strip
// hours and the contact buttons all ship INERT unless Templates passes the new
// props. The shells are .tsx server components the plain-Node runner cannot
// load, so the threading is pinned from source (the bindingTargets precedent).
const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('Footer threads palette, hours and timezone into the renderer footer', () => {
  const code = source('./Footer/index.tsx');
  assert.match(code, /palette=\{\{\s*secondary: siteData\?\.secondary,\s*surface: siteData\?\.surface,/);
  assert.match(code, /'text-primary': siteData\?\.\['text-primary'\]/);
  assert.match(code, /'text-secondary': siteData\?\.\['text-secondary'\]/);
  // W25-5ca: the business hours through `footerHours`, which passes them on when
  // they are the site's one hours set (lib/footerHours.test.ts).
  assert.match(code, /hours=\{footerHours\(siteData\)\}/);
  assert.match(code, /timezone=\{siteData\?\.timezone\}/);
});

test('REFUSE (OD-9): the footer never inherits an email the owner hid', () => {
  assert.match(source('./Footer/index.tsx'), /showEmail === false \? undefined : siteData\?\.businessInfo\?\.contactInfo\?\.email/);
});

test('Navbar threads hours and timezone for the utility strip', () => {
  const code = source('./Navigation/Navbar.tsx');
  assert.match(code, /hours=\{siteData\?\.businessInfo\?\.hours \?\? null\}/);
  assert.match(code, /timezone=\{siteData\?\.timezone\}/);
});

test('the root layout mounts ContactButtons from the gated slice and feeds the JSON-LD the parsed hours', () => {
  const code = source('../app/layout.tsx');
  assert.match(code, /const contactSlice = contactButtonsSiteData\(siteData\);/);
  assert.match(code, /\{contactSlice && <ContactButtonsChrome siteData=\{contactSlice\} \/>\}/);
  assert.match(code, /hours: readSiteHours\(siteData\.businessInfo\?\.hours\),/);
});

test('FP2-55: the contact bar bridge hands the renderer the current path', () => {
  const code = source('./ContactButtonsChrome.tsx');
  assert.match(code, /^'use client';/);
  assert.match(code, /const pathname = usePathname\(\);/);
  assert.match(code, /<ContactButtons siteData=\{siteData as RendererSiteData\} currentPath=\{pathname\} \/>/);
});

test('FP2-27: every item-detail mount tells the header there is no masthead, and the shell threads it', () => {
  const detail = source('../app/[slug]/[itemId]/page.tsx');
  const mounts = detail.match(/<Navbar\b[^>]*\/>/g) ?? [];
  assert.ok(mounts.length >= 6, `found the detail mounts (${mounts.length})`);
  for (const mount of mounts) assert.equal(mount, '<Navbar hasMasthead={false} />');
  const shell = source('./Navigation/Navbar.tsx');
  assert.match(shell, /hasMasthead=\{hasMasthead\}/);
});

test('FP2-27 ALLOW/REFUSE: with no masthead a transparent-on-hero header is solid at scroll 0; the default keeps the see-through bar', async () => {
  const url = new URL('../../node_modules/@hillbombcreations/site-renderer/dist/chrome/resolveChrome.js', import.meta.url);
  // Cast: a module imported by file URL is untyped; only this one export is read.
  const { resolveTransparentHeroChrome } = (await import(url.href)) as {
    resolveTransparentHeroChrome: (scrolled: boolean, hasMasthead?: boolean) => Record<string, unknown>;
  };
  assert.equal(typeof resolveTransparentHeroChrome, 'function', 'loaded the renderer module, not nothing');
  const solid = resolveTransparentHeroChrome(true);
  assert.deepEqual(resolveTransparentHeroChrome(false, false), solid, 'detail page: the solid token set at scroll 0');
  assert.notDeepEqual(resolveTransparentHeroChrome(false), solid, 'a page with a hero keeps the see-through bar at scroll 0');
});

// Next release 2026-12, plan 3.T (build log 2026-11-02, renderer #128): 1.95.0
// judges a dock's, a strip's and the footer's text against the site's own
// colours only when Templates hands them over. Without these props the four
// rail and bar rows of the owner-approved contrast-fleet-list.md (Unique
// Creation Salon, Halo Blow Dry Bar, Juniper Row, Windward House) never go live.
test('the root layout hands the site colours to the docks and the fulfillment strip', () => {
  const code = source('../app/layout.tsx');
  assert.ok(code.length > 500, 'layout.tsx was read');
  assert.match(code, /import \{ themePalette \} from '@hillbombcreations\/site-renderer\/contrast';/);
  assert.match(code, /<FulfillmentStrip config=\{siteData\.fulfillmentStrip\} palette=\{chromePalette\} \/>/);
  assert.match(code, /<UtilityDock \{\.\.\.siteData\.utilityDock\} palette=\{chromePalette\} \/>/);
  assert.match(code, /<EdgeDock \{\.\.\.siteData\.edgeDock\} palette=\{chromePalette\} \/>/);
  assert.match(code, /const chromePalette = themePalette\(siteData\);/);
});

test('Footer hands the renderer text-inverse, the dark arm and newsletter label ink', () => {
  assert.match(source('./Footer/index.tsx'), /'text-inverse': siteData\?\.\['text-inverse'\]/);
});

test('ALLOW: at the pinned renderer the dock palette is load-bearing (a navy rail label reads 60%, not 55%)', async () => {
  const dist = new URL('../../node_modules/@hillbombcreations/site-renderer/dist/', import.meta.url);
  // Cast: modules imported by file URL are untyped; only these exports are read.
  const { default: EdgeDock } = (await import(new URL('chrome/EdgeDock.js', dist).href)) as { default: FunctionComponent<Record<string, unknown>> };
  const { themePalette } = (await import(new URL('contrast/index.js', dist).href)) as { themePalette: (site: object) => Record<string, unknown> };
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  // The stored colours of the Unique Creation Salon row (fixture 2026-10-27).
  const site = { primary: '#A5117A', surface: '#FFFFFF', 'text-primary': '#141A2E', 'text-secondary': '#5B6076', name: 'not a colour' };
  const rail = { label: 'Book a look', actions: [{ label: 'Book', href: '/book' }] };
  const without = renderToStaticMarkup(createElement(EdgeDock, rail));
  const withPalette = renderToStaticMarkup(createElement(EdgeDock, { ...rail, palette: themePalette(site) }));
  assert.match(without, /var\(--text-primary\) 55%/, 'control: no palette, the label is drawn at 55%');
  assert.match(withPalette, /#141a2e 60%/, 'with the palette the label is corrected, as the approved list says');
  assert.deepEqual(Object.keys(themePalette(site)).sort(), ['primary', 'surface', 'text-primary', 'text-secondary'], 'only theme colours are handed over');
});
