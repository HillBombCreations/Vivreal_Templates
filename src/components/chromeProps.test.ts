import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
