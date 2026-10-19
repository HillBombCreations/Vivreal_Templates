import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Registered before the dynamic import below, which is what lets the loader
// intercept `next/server` and the `@/` aliases. See the loader's header.
register(new URL('./testSupport/middlewareLoader.mjs', import.meta.url).href);

// research-site-5xx-2026-10-17.md fix 1. During a VR_Client_API outage the page
// layer answers 5xx rather than 404 (degraded.ts), so scanner probes got 500.
// Middleware now answers them 404 before anything reads site data. These tests
// run the REAL middleware against a mocked upstream that is down, exactly the
// 2026-10-17 shape (siteDetails refused with 403).

// fetchSiteMap() skips the network when either is unset, which would make
// "fetch was not called" true for the wrong reason. Set, so the control below
// proves the mock really sees the edge-map fetch.
process.env.API_KEY = 'test-api-key';
process.env.SITE_ID = 'test-site-id';

const { middleware } = await import('./middleware.ts');
const { __resetEdgeSiteMapCacheForTests } = await import('./lib/edgeSiteMap.ts');

let fetchCalls: string[] = [];

beforeEach(() => {
  __resetEdgeSiteMapCacheForTests();
  fetchCalls = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch; // the mock implements only the call shape middleware uses
});

interface StubResponse {
  kind: 'response' | 'next' | 'redirect';
  status: number;
  body: unknown;
  headers: Headers;
}

function requestFor(pathname: string, init: { cookie?: string; method?: string } = {}) {
  const url = new URL(pathname, 'https://site.example.com');
  return {
    method: init.method ?? 'GET',
    url: url.href,
    nextUrl: url,
    headers: new Headers({ 'user-agent': 'scanner' }),
    cookies: { has: (name: string) => name === init.cookie },
  };
}

async function run(pathname: string, init?: { cookie?: string; method?: string }): Promise<StubResponse> {
  // The stub request is duck-typed to the members middleware.ts reads; the
  // real NextRequest cannot be built outside Next's runtime.
  return (await middleware(requestFor(pathname, init) as never)) as unknown as StubResponse;
}

const PROBES = [
  '/ebkid.php',
  '/xmlrpc.php',
  '/wp-login.php',
  '/magento/index.php/admin',
  '/wp-admin/css/install',
  '/wp-content/plugins/x',
  '/wp-includes/wlwmanifest',
  '/cgi-bin/luci',
  '/.env',
  '/.env.production',
  '/.git/config',
];

for (const probe of PROBES) {
  test(`REFUSE: ${probe} answers a data-free 404 during an upstream outage`, async () => {
    const response = await run(probe);
    assert.equal(response.kind, 'response');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, max-age=0, must-revalidate');
    assert.deepEqual(fetchCalls, [], 'a probe must not read site data');
  });
}

test('REFUSE: a preview cookie does not carry a probe past the 404', async () => {
  const response = await run('/wp-admin/setup', { cookie: 'vr-preview-token' });
  assert.equal(response.status, 404);
  assert.deepEqual(fetchCalls, []);
});

test('REFUSE: HEAD gets the same 404', async () => {
  const response = await run('/ebkid.php', { method: 'HEAD' });
  assert.equal(response.status, 404);
  assert.deepEqual(fetchCalls, []);
});

test('control: a real page path under the same outage DOES reach the edge-map fetch', async () => {
  // Without this, "fetch was not called" above could mean the mock is never
  // reached at all. Same mock, same env, a real slug: the fetch happens and
  // the request falls through to the page layer unchanged.
  const response = await run('/about');
  assert.equal(response.kind, 'next');
  assert.ok(fetchCalls.some((url) => url.includes('/tenant/siteDetails')), `fetch calls: ${fetchCalls.join(', ')}`);
});

const REAL_PATHS = [
  '/',
  '/about',
  '/wp-engine-review',
  '/cgi-bin-guide',
  '/env-setup',
  '/shop/6721f0c2a1b2c3d4e5f60718',
  '/features/ai-sites',
  '/blog/version-1.2',
  '/robots.txt',
  '/sitemap.xml',
  '/sitemaps/2.xml',
  '/llms.txt',
  '/favicon.ico',
  '/feeds/schedule.ics',
  '/.well-known/llms.txt',
  '/.well-known/mcp.json',
  '/_next/static/chunks/main-app.js',
  '/api/contact',
  '/og/about',
  '/icon',
];

for (const pathname of REAL_PATHS) {
  test(`ALLOW: ${pathname} is never answered by the probe 404`, async () => {
    const response = await run(pathname);
    assert.notEqual(response.status, 404);
    assert.equal(response.kind, 'next', 'falls through to the route, as before this change');
  });
}
