/**
 * V7.51 (v6 production walk, F6). Every 404 on every site rendered a bare
 * "404 / Oops! Page not found" page with no site header and no footer
 * (Larkspur `/privacy`), so a visitor who followed a dead link lost the
 * site's own menu and had one way out. The boundary now mounts the same
 * Navbar and Footer shells every page uses.
 *
 * not-found.tsx is JSX and its shells read `server-only` data, so
 * `node --experimental-strip-types` cannot load it; this pins the source,
 * matched on names, never on formatting (the [slug]/page.test.ts tradeoff).
 * The shells themselves cannot throw on an upstream failure: `getSiteData`
 * answers FALLBACK_SITE_DATA instead (src/lib/api/siteData/index.tsx), which
 * is what keeps this boundary safe for the 404 status.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./not-found.tsx', import.meta.url), 'utf8');

test('[V7.51 REFUSE] the 404 page is not served without the site header and footer', () => {
  assert.match(source, /import Navbar from ["']@\/components\/Navigation\/Navbar["']/, 'Navbar shell imported');
  assert.match(source, /import Footer from ["']@\/components\/Footer["']/, 'Footer shell imported');
  assert.match(source, /<Navbar\b[^>]*\/>/, 'the header is mounted');
  assert.match(source, /<Footer\s*\/>/, 'the footer is mounted');
});

test('[V7.51 REFUSE] the header is told there is no hero under it', () => {
  // A transparent-on-hero kit (Larkspur) would otherwise paint white ink on
  // the light 404 body at scroll 0, the FP2-27 detail-page case.
  assert.match(source, /<Navbar\b[^>]*hasMasthead=\{false\}/);
});

test('[V7.51 ALLOW] the 404 keeps its title, its message and its way home', () => {
  assert.match(source, /title: "404 Not Found"/);
  assert.match(source, /Page not found/);
  assert.match(source, /href="\/"/);
  assert.doesNotMatch(source, /from ["']next\/head["']/, 'still no Pages Router head import');
});
