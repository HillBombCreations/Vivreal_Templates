import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
import { resolveRedirect } from './redirects.ts';

// resolveRedirect is the read side of the WS3 301 mechanism (two-axis-detail-
// route-design.md §5.1) — the migrator writes `blueprint.redirects` onto
// siteData.redirects; this resolves a request path against that map.

test('absent redirects ⇒ undefined (byte-identical no-op — the fleet default)', () => {
  assert.equal(resolveRedirect(undefined, '/old-page'), undefined);
  assert.equal(resolveRedirect(null, '/old-page'), undefined);
});

test('empty redirects array ⇒ undefined', () => {
  assert.equal(resolveRedirect([], '/old-page'), undefined);
});

test('exact single-segment match', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('exact multi-segment match (a flattened deep slug source)', () => {
  const redirects = [
    { from: '/classes/category/baking-classes', to: '/baking-classes', status: 301 as const },
  ];
  assert.equal(
    resolveRedirect(redirects, '/classes/category/baking-classes'),
    '/baking-classes',
  );
});

test('no match ⇒ undefined', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/unrelated'), undefined);
});

test('trailing slash / missing leading slash on the incoming path are normalized', () => {
  const redirects = [{ from: '/old-page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page/'), '/new-page');
  assert.equal(resolveRedirect(redirects, 'old-page'), '/new-page');
});

test('trailing slash authored on the redirect entry itself still matches', () => {
  const redirects = [{ from: '/old-page/', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('picks the correct entry out of several', () => {
  const redirects = [
    { from: '/a', to: '/a2', status: 301 as const },
    { from: '/b', to: '/b2', status: 301 as const },
    { from: '/c', to: '/c2', status: 301 as const },
  ];
  assert.equal(resolveRedirect(redirects, '/b'), '/b2');
});

test('a malformed entry in the array is skipped, not thrown on', () => {
  const redirects = [null, { from: '/old-page', to: '/new-page', status: 301 as const }] as unknown as {
    from: string;
    to: string;
  }[];
  assert.equal(resolveRedirect(redirects, '/old-page'), '/new-page');
});

test('is case-sensitive and does not fuzzy-match (design doc §10 — no fuzzy matching, ever)', () => {
  const redirects = [{ from: '/Old-Page', to: '/new-page', status: 301 as const }];
  assert.equal(resolveRedirect(redirects, '/old-page'), undefined);
});
