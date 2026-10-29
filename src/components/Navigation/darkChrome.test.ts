import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// By path, not package name: the barrel pulls `next/link` (see siteFont.test.ts).
import { resolveMastheadTone } from '../../../node_modules/@hillbombcreations/site-renderer/dist/chrome/resolveChrome.js';

/**
 * Owner find 3 (renderer 1.90.0, Revision 4): the server Navbar shell passes
 * the stored `surface-alt` to the renderer, as `surfaceAlt` and as the second
 * argument of `resolveMastheadTone`, ONLY on a Mood dark site. Every other
 * site keeps the one-argument call and no `surfaceAlt`, so its header is
 * byte-identical to 1.89.1 (gate G-R step 3). The shell is an async server
 * component that fetches, so the wiring is pinned as source and the decision
 * it feeds is run through the installed renderer.
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

const navbar = () => code(read('./Navbar.tsx'));

test('REFUSE: a site that is not Dark gets the one-argument masthead question and no surfaceAlt', () => {
  const src = navbar();
  const calls = src.match(/resolveMastheadTone\(/g) ?? [];
  assert.equal(calls.length, 2, `expected exactly the Dark and the non-Dark call, found ${calls.length}`);
  // The one-argument call is reachable only through the non-Dark arm.
  assert.match(
    src,
    /const mastheadTone = darkSite \? resolveMastheadTone\(page \?\? null, darkSite\) : resolveMastheadTone\(page \?\? null\);/,
  );
  // The Dark inputs exist only when the stored Mood is exactly 'dark'; otherwise null.
  assert.match(src, /const darkSite =\s*siteData\?\.chrome === 'dark'\s*\?\s*\{\s*chrome: siteData\.chrome,\s*surfaceAlt: typeof siteData\['surface-alt'\] === 'string' \? siteData\['surface-alt'\] : undefined,\s*\.\.\.\(renderedHero \? \{ renderedHero \} : \{\}\),\s*\}\s*:\s*null;/);
});

test('ALLOW: a Dark site passes its stored surface-alt to the renderer header, from the same Dark-only object', () => {
  const src = navbar();
  assert.match(src, /chrome=\{siteData\?\.chrome as 'dark' \| 'light' \| undefined\}/, 'parsed the shell but the chrome prop is missing');
  const spreads = src.match(/\{\.\.\.\(darkSite \? \{ surfaceAlt: darkSite\.surfaceAlt \} : \{\}\)\}/g) ?? [];
  assert.equal(spreads.length, 1);
});

test('REFUSE: a non-Dark site carries no surfaceAlt key at all, not even an undefined one (RSC payload byte-identical)', () => {
  const src = navbar();
  // No JSX attribute form, which would send `surfaceAlt: undefined` across the client boundary.
  assert.deepEqual(src.match(/\bsurfaceAlt=\{/g) ?? [], []);
  // The spread's non-Dark arm adds no key: evaluate both arms as the shell does.
  const props = (darkSite: { surfaceAlt?: string } | null) => ({ chrome: 'light', ...(darkSite ? { surfaceAlt: darkSite.surfaceAlt } : {}) });
  assert.deepEqual(Object.keys(props(null)), ['chrome']);
  assert.equal(JSON.stringify(props(null)), '{"chrome":"light"}');
  assert.deepEqual(Object.keys(props({ surfaceAlt: undefined })), ['chrome', 'surfaceAlt'], 'control: the Dark arm does add the key');
});

const PRICING = { hero: { variant: 'statement', headline: 'Pricing' } };
const PHOTO_TOP = { hero: { variant: 'statement', background: { type: 'image' } } };

test('ALLOW: on a Dark site the media-less top the renderer now darkens answers dark (vivreal.io pricing)', () => {
  assert.equal(resolveMastheadTone(PRICING, { chrome: 'dark', surfaceAlt: '#eeeff0' }), 'dark');
  // Nocturne-style own dark keeps its colour, and the top is still dark.
  assert.equal(resolveMastheadTone(PRICING, { chrome: 'dark', surfaceAlt: '#18181f' }), 'dark');
});

test("REFUSE: the one-argument call a non-Dark site makes keeps 1.89.1's answers", () => {
  assert.equal(resolveMastheadTone(PRICING), 'light');
  assert.equal(resolveMastheadTone(PHOTO_TOP), 'dark');
  assert.equal(resolveMastheadTone(null), null);
  // A Dark site with no stored surface-alt cannot decide a ground: today's answer.
  assert.equal(resolveMastheadTone(PRICING, { chrome: 'dark', surfaceAlt: undefined }), 'light');
});
