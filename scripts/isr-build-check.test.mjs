/**
 * The ISR build check's assertions, fed planted manifests and responses, so
 * a PASS from scripts/isr-build-check.mjs is a check that can fail.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEW_PAGE_TEXT, OWNER_BOOK_TEXT, STOREFRONT_TEXT, checkAfterFlip, checkManifest, checkResponses, checkVersionFence, routeTable } from './isr-build-check.mjs';

const GOOD = {
  routes: {
    '/about': { initialRevalidateSeconds: 300 },
    '/links': { initialRevalidateSeconds: 300 },
    '/blog/first-loaf': { initialRevalidateSeconds: 300 },
  },
  dynamicRoutes: {},
};

test('ALLOW: the target manifest passes', () => {
  assert.deepEqual(checkManifest(GOOD, { gateOn: true }), []);
});

test('REFUSE: a build fallback on either route fails', () => {
  for (const key of ['/[slug]', '/[slug]/[itemId]']) {
    const out = checkManifest({ ...GOOD, dynamicRoutes: { [key]: {} } }, { gateOn: true });
    assert.equal(out.length, 1, key);
  }
});

test('REFUSE: the base shape (no inner page prerendered) fails, and so does a storefront that was', () => {
  assert.equal(checkManifest({ routes: {}, dynamicRoutes: {} }, { gateOn: true }).length, 3);
  assert.equal(checkManifest({ ...GOOD, routes: { ...GOOD.routes, '/shop': { initialRevalidateSeconds: 300 } } }, { gateOn: true }).length, 1);
  assert.deepEqual(checkManifest(null, { gateOn: true }), ['no prerender manifest was parsed']);
});

test('REFUSE (review B1): /book or /booking in the build list fails', () => {
  for (const route of ['/book', '/booking', '/menu', '/events', '/faq']) {
    assert.equal(checkManifest({ ...GOOD, routes: { ...GOOD.routes, [route]: { initialRevalidateSeconds: 300 } } }, { gateOn: true }).length, 1, route);
  }
});

const ok = (headers, status = 200, body = '') => ({ status, headers, body });
const HIT = { 'x-nextjs-cache': 'HIT', 'cache-control': 's-maxage=300, stale-while-revalidate=31535700' };
const NO_STORE = { 'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate' };
function reads(over = {}) {
  const base = {
    '/': ok(HIT), '/about': ok(HIT), '/links': ok(HIT), '/blog/first-loaf': ok(HIT), '/blog/6a0000000000000000000d02': ok(NO_STORE),
    '/shop': ok(NO_STORE), '/checkoutsuccess?session_id=cs_test_abc': ok(NO_STORE), '/book': ok(NO_STORE, 200, `<h1>${OWNER_BOOK_TEXT}</h1>`),
    '/booking': ok(NO_STORE), '/booking/manage': ok(NO_STORE), '/menu': ok(NO_STORE), '/menu?sort=price': ok(NO_STORE),
    '/events': ok(NO_STORE), '/faq?q=loaf': ok(NO_STORE),
    ...over,
  };
  return Object.entries(base).map(([path, second]) => ({ path, first: second, second }));
}

test('ALLOW: the target responses pass; REFUSE: the base no-store about page fails', () => {
  assert.deepEqual(checkResponses(reads(), { gateOn: true }), []);
  assert.equal(checkResponses(reads({ '/about': ok(NO_STORE) }), { gateOn: true }).length, 1);
});

test('REFUSE: a 500 anywhere fails, and a cached storefront fails', () => {
  assert.ok(checkResponses(reads({ '/blog/6a0000000000000000000d02': ok(NO_STORE, 500) }), { gateOn: true }).length >= 1);
  assert.equal(checkResponses(reads({ '/shop': ok(HIT) }), { gateOn: true }).length, 1);
  assert.equal(checkResponses(reads({ '/menu?sort=price': ok(HIT) }), { gateOn: true }).length, 1);
});

test('REFUSE (review B1): /book answering 500, 404 or without the owner page fails', () => {
  assert.ok(checkResponses(reads({ '/book': ok(NO_STORE, 500) }), { gateOn: true }).length >= 1);
  assert.ok(checkResponses(reads({ '/book': ok(NO_STORE, 404) }), { gateOn: true }).length >= 1);
  assert.ok(checkResponses(reads({ '/book': ok(NO_STORE, 200, 'something else') }), { gateOn: true }).length >= 1);
});

test('REFUSE: an inner page cached for less than the home page fails', () => {
  const short = { 'x-nextjs-cache': 'HIT', 'cache-control': 's-maxage=30' };
  assert.equal(checkResponses(reads({ '/links': ok(short) }), { gateOn: true }).length, 1);
});

test('ALLOW (review B2): an accepted flip and no 500 after it passes; REFUSE: any 500, or an unaccepted flip, fails', () => {
  const flip = { status: 200, body: '{"revalidated":true,"tags":["site:x"]}' };
  const fresh = { path: '/about', status: 200, body: `<li>${STOREFRONT_TEXT}</li>` };
  const stale = { path: '/about', status: 200, body: '<h1>About us</h1>' };
  assert.deepEqual(checkAfterFlip(flip, [stale, fresh]), []);
  assert.equal(checkAfterFlip(flip, [fresh, { path: '/about', status: 500, body: '' }]).length, 1);
  assert.equal(checkAfterFlip({ status: 401, body: '' }, [fresh]).length, 1);
  assert.equal(checkAfterFlip(flip, []).length, 1, 'nothing read is not a pass');
  assert.equal(checkAfterFlip(flip, [stale, stale, stale]).length, 1, 'a failed regeneration behind a stale copy is not a pass');
});

test('route table rows', () => {
  assert.deepEqual(routeTable({ routes: { '/a': { initialRevalidateSeconds: false } }, dynamicRoutes: { '/[slug]': {} } }), [
    { route: '/[slug]', kind: 'fallback' },
    { route: '/a', kind: 'static' },
  ]);
});

test('F41: the fence phase passes only on the plain read while down, a 404 before, then the new page with its v', () => {
  const at = '2026-11-05T01:02:03.000Z';
  const good = {
    down: { status: 200 },
    downShellReads: ['/tenant/siteDetails?siteId=6a0000000000000000000a01'],
    before: { status: 404 },
    after: [{ status: 404, body: '' }, { status: 200, body: `<h2>${NEW_PAGE_TEXT}</h2>` }],
    shellReads: [`/tenant/siteDetails?siteId=6a0000000000000000000a01&v=${encodeURIComponent(at)}`],
    updatedAt: at,
  };
  assert.deepEqual(checkVersionFence(good), []);
  assert.equal(checkVersionFence({ ...good, after: [{ status: 404, body: '' }, { status: 404, body: '' }] }).length, 1, 'a stale 404 fails');
  assert.equal(checkVersionFence({ ...good, downShellReads: [`${good.downShellReads[0]}&v=x`] }).length, 1, 'v while the version route failed fails');
  assert.equal(checkVersionFence({ ...good, shellReads: [good.downShellReads[0]] }).length, 1, 'no versioned read fails');
  assert.equal(checkVersionFence({ ...good, before: { status: 200 } }).length, 1, 'the control must be a 404');
  assert.equal(checkVersionFence({ ...good, after: [] }).length, 2, 'nothing read is not a pass');
  assert.equal(checkVersionFence({ ...good, after: [{ status: 500, body: '' }, good.after[1]] }).length, 1, 'a 500 fails');
});
