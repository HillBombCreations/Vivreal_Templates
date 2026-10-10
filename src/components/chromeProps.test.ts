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
  assert.match(code, /hours=\{siteData\?\.businessInfo\?\.hours \?\? null\}/);
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
  assert.match(code, /\{contactSlice && \(/);
  assert.match(code, /<ContactButtons siteData=\{contactSlice as RendererSiteData\} \/>/);
  assert.match(code, /hours: readSiteHours\(siteData\.businessInfo\?\.hours\),/);
});
