import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { getSignedUrl } from './api/media.ts';

/**
 * B1 media leg (renderer 1.54.0 R2) — `navigation.brand.logoScrolledKey`, the
 * header's SOLID-state wordmark.
 *
 * A `headerStyle:'transparent-on-hero'` site authors a LIGHT wordmark for the
 * transparent-over-dark-hero state; once the bar flips to its solid token set
 * that wordmark sits white-on-white and the brand disappears. VR_Client_API
 * signs the bare key into the sibling `brand.logoScrolled`, and this wrapper is
 * the ONLY place that can turn it into the renderer's `logoScrolledUrl` prop —
 * the renderer cannot sign URLs and Templates' `buildPageContext` deliberately
 * omits `getSignedUrl`, so an unthreaded prop means the seat renders nothing on
 * every live site, with no error anywhere.
 *
 * WHY A SOURCE-WIRING TEST: `Navbar.tsx` is an async Server Component that
 * fetches siteData and imports the renderer's ESM barrel, so it is not
 * unit-renderable in this repo (every test here covers `src/lib/**` pure
 * logic). `src/lib/redirects.test.ts` already establishes the technique for
 * pinning a wiring contract that only exists at a call site: read the source,
 * strip `//` comments (this file's own prose names the props), assert on CODE.
 */
const navbarCode = (): string => {
  const navbarPath = fileURLToPath(new URL('../components/Navigation/Navbar.tsx', import.meta.url));
  return readFileSync(navbarPath, 'utf8')
    // CRLF-safe: `\r` is a JS line terminator, so on a Windows checkout a
    // trailing `\r` would stop `.` short and the strip below would no-op.
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
};

test('Navbar.tsx wiring: threads logoScrolledUrl to the renderer Navbar', () => {
  assert.match(
    navbarCode(),
    /logoScrolledUrl=\{/,
    'Navbar.tsx must pass logoScrolledUrl — the renderer cannot sign URLs, so an unthreaded prop is invisible on every live site',
  );
});

test('Navbar.tsx wiring: logoScrolledUrl is derived by SIGNING brand.logoScrolled, never the bare key', () => {
  const code = navbarCode();
  assert.match(
    code,
    /const logoScrolledUrl = [^\n]*getSignedUrl\(brand!\.logoScrolled\)/,
    'the value must come from getSignedUrl(brand.logoScrolled) — the bare logoScrolledKey is an S3 key, not a URL',
  );
  assert.match(
    code,
    /const logoScrolledUrl = has\('logoScrolledKey'\)/,
    'presence-means-override on the BARE key, same gate as logoKey one field over',
  );
});

test("Navbar.tsx wiring: an absent seat resolves to null, not '' — the renderer's byte-identical default", () => {
  assert.match(
    navbarCode(),
    /const logoScrolledUrl = has\('logoScrolledKey'\) \? getSignedUrl\(brand!\.logoScrolled\) : null;/,
    'absent ⇒ null ⇒ the renderer falls back to logoUrl in every state',
  );
});

test('getSignedUrl reads the signed source VR_Client_API writes onto brand.logoScrolled', () => {
  // The exact shape processSiteDetails.js writes for this seat:
  // `{ key, currentFile: { source } }` — no `name`, which is what keeps it out
  // of the backends' `{key,name}` descriptor walks.
  const signed = { key: 'groupObjects/s1/9/dark.svg', currentFile: { source: 'https://cdn/dark.svg' } };
  assert.equal(getSignedUrl(signed), 'https://cdn/dark.svg');
  // An unsigned seat (promotion landed, signing did not) must not yield a
  // half-usable value — '' lets the renderer fall back to logoUrl.
  assert.equal(getSignedUrl({ key: 'groupObjects/s1/9/dark.svg' }), '');
  assert.equal(getSignedUrl(undefined), '');
});
