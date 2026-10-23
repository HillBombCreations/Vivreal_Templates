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

// Directory and dot-file probes only: these never read site data. Extension
// probes (`/ebkid.php`) read the edge map's redirects first, see the legacy
// redirect tests below.
const PROBES = [
  '/wp-admin/css/install',
  '/wp-content/plugins/x',
  '/wp-includes/wlwmanifest',
  '/cgi-bin/luci',
  '/.env',
  '/.env.production',
  '/.git/config',
  // TEMPLATES-5 R1 (triage-sentry-clickup-2026-10-22.md), the 2026-10-22 burst.
  '/html/.git/config',
  '/yarn.lock',
  '/composer.json',
  '/composer.lock',
  '/backend/.env.production',
  '/assets/main.js.map',
  '/pnpm-lock.yaml',
  '/html/package-lock.json',
  '/package.json',
  '/bun.lockb',
  '/npm-shrinkwrap.json',
  '/Gemfile.lock',
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
  const response = await run('/wp-admin/setup', { method: 'HEAD' });
  assert.equal(response.status, 404);
  assert.deepEqual(fetchCalls, []);
});

test('REFUSE: HEAD on an extension probe gets the 404 during an outage', async () => {
  const response = await run('/ebkid.php', { method: 'HEAD' });
  assert.equal(response.status, 404);
});

test('control: a real page path under the same outage DOES reach the edge-map fetch', async () => {
  // Without this, "fetch was not called" above could mean the mock is never
  // reached at all. Same mock, same env, a real slug: the fetch happens and
  // the request falls through to the page layer unchanged.
  const response = await run('/about');
  assert.equal(response.kind, 'next');
  assert.ok(fetchCalls.some((url) => url.includes('/tenant/siteDetails')), `fetch calls: ${fetchCalls.join(', ')}`);
});

// BLOCK 1 of the PR #197 review: a legacy-extension address can be an
// authored redirect's `from`. Site_Migrator's buildRedirectMap writes
// `{ from: '/about.php', to: '/about' }` for a migrated PHP or ASP site, and
// before the probe 404 that request reached `[slug]/page.tsx`, where
// `resolveMissingItemRedirect` + `permanentRedirect` answered 308 to the
// target with the query dropped. That answer must survive.
function useHealthyMap(redirects: Array<{ from: string; to: string; status?: number }>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    return new Response(
      JSON.stringify({
        success: true,
        data: { pages: [{ slug: 'about' }, { slug: 'store' }], redirects, siteDetails: { values: {} } },
        error: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch; // the mock implements only the call shape middleware uses
}

const MIGRATED_REDIRECTS = [
  { from: '/about.php', to: '/about', status: 301 },
  { from: '/store/index.jsp', to: '/store', status: 301 },
  { from: '/loop.php', to: '/loop.php', status: 301 },
  { from: '/hostile.asp', to: '//evil.example', status: 301 },
];

function assertPermanentRedirect(response: StubResponse, expectedPath: string) {
  assert.equal(response.kind, 'redirect');
  // 308, the status `permanentRedirect()` at `[slug]/page.tsx` gave this path
  // before b65a539, not middleware's own 301.
  assert.equal(response.status, 308);
  const location = new URL(response.headers.get('location') ?? '', 'https://site.example.com');
  assert.equal(location.origin, 'https://site.example.com');
  assert.equal(`${location.pathname}${location.search}`, expectedPath);
}

test('ALLOW: /about.php with an authored redirect answers the same 308 as before the probe 404', async () => {
  useHealthyMap(MIGRATED_REDIRECTS);
  assertPermanentRedirect(await run('/about.php'), '/about');
});

test('ALLOW: the legacy redirect drops the query, as permanentRedirect(target) did', async () => {
  useHealthyMap(MIGRATED_REDIRECTS);
  assertPermanentRedirect(await run('/about.php?id=7'), '/about');
});

test('ALLOW: a multi-segment legacy address follows its authored redirect', async () => {
  useHealthyMap(MIGRATED_REDIRECTS);
  assertPermanentRedirect(await run('/store/index.jsp'), '/store');
});

test('ALLOW: legacy redirect matching is case-sensitive like the page layer, so /About.php is not /about.php', async () => {
  useHealthyMap(MIGRATED_REDIRECTS);
  const response = await run('/About.php');
  assert.equal(response.status, 404);
});

for (const [label, pathname] of [
  ['an unmatched probe', '/ebkid.php'],
  ['a mid-path probe', '/magento/index.php/admin'],
  ['a self-loop redirect', '/loop.php'],
  ['a cross-origin redirect target', '/hostile.asp'],
] as const) {
  test(`REFUSE: ${label} (${pathname}) answers 404 against a healthy map`, async () => {
    useHealthyMap(MIGRATED_REDIRECTS);
    const response = await run(pathname);
    assert.equal(response.kind, 'response');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, max-age=0, must-revalidate');
    assert.equal(response.headers.get('location'), null);
  });
}

for (const pathname of ['/about.php', '/ebkid.php', '/xmlrpc.php', '/wp-login.php', '/magento/index.php/admin']) {
  test(`REFUSE: ${pathname} answers 404, not 5xx, when the map is null in an outage`, async () => {
    // The default beforeEach mock: siteDetails refused with 403, map null.
    const response = await run(pathname);
    assert.equal(response.kind, 'response');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, max-age=0, must-revalidate');
    // The map really was asked for, so "null map" is the outage, not a skip.
    assert.ok(fetchCalls.some((url) => url.includes('/tenant/siteDetails')), `fetch calls: ${fetchCalls.join(', ')}`);
  });
}

const REAL_PATHS = [
  '/',
  '/about',
  '/wp-engine-review',
  '/cgi-bin-guide',
  '/env-setup',
  '/wp-configuration-guide',
  '/wp-config',
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
  '/_next/static/chunks/main-app.js.map',
  '/roadmap',
  '/locksmith-services',
  '/composers/bach',
  '/packages/gift-box',
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

// Discovery batch 3.4 (design section 6, row "Demo"). A demo's robots.txt now
// says Allow, so every demo response must carry X-Robots-Tag itself. Layer 1
// is this file; layer 2 (the route handlers) is demoRobotsHeader.test.ts.
function serveLifecycle(values: Record<string, unknown>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    return new Response(
      JSON.stringify({ success: true, data: { pages: [{ slug: 'about' }], siteDetails: { values } }, error: null }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch; // the mock implements only the call shape middleware uses
}

const NON_DOCUMENT_PATHS = ['/llms.txt', '/.well-known/mcp.json', '/sitemap.xml', '/og/about', '/robots.txt', '/api/contact'];

test('ALLOW (demo): a document response carries X-Robots-Tag: noindex, nofollow', async () => {
  serveLifecycle({ lifecycleState: 'demo' });
  for (const pathname of ['/', '/about', '/about/item-1']) {
    const response = await run(pathname);
    assert.equal(response.kind, 'next');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', pathname);
  }
});

test('ALLOW (demo): llms.txt, mcp.json, sitemap, OG and robots responses carry it once the map is warm', async () => {
  serveLifecycle({ lifecycleState: 'demo' });
  await run('/about'); // warms the map, as any page view does
  for (const pathname of NON_DOCUMENT_PATHS) {
    const response = await run(pathname);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow', pathname);
  }
});

test('ALLOW (demo): a fail-safe lifecycle value (null, "", "Demo") is a demo here too', async () => {
  for (const lifecycleState of [null, '', 'Demo']) {
    __resetEdgeSiteMapCacheForTests();
    serveLifecycle({ lifecycleState });
    assert.equal((await run('/about')).headers.get('x-robots-tag'), 'noindex, nofollow', JSON.stringify(lifecycleState));
  }
});

test('REFUSE (live): no response on a live site carries X-Robots-Tag', async () => {
  serveLifecycle({ lifecycleState: 'live' });
  await run('/about');
  for (const pathname of ['/', '/about', ...NON_DOCUMENT_PATHS]) {
    assert.equal((await run(pathname)).headers.get('x-robots-tag'), null, pathname);
  }
});

test('REFUSE (pre-lifecycle site): an ABSENT lifecycleState is not a demo, so no header', async () => {
  delete process.env.SITE_LIFECYCLE;
  serveLifecycle({});
  assert.equal((await run('/about')).headers.get('x-robots-tag'), null);
});

test('REFUSE (demo): hashed build assets under /_next/static are not stamped', async () => {
  serveLifecycle({ lifecycleState: 'demo' });
  await run('/about');
  assert.equal((await run('/_next/static/chunks/main-app.js')).headers.get('x-robots-tag'), null);
});

test('REFUSE (demo, cold map): a non-document path never waits for the map, so middleware adds nothing', async () => {
  // Layer 2 covers this case (the route handlers stamp it themselves). The
  // point here is the other half: llms.txt must not start blocking on a read.
  serveLifecycle({ lifecycleState: 'demo' });
  const response = await run('/llms.txt');
  assert.equal(response.kind, 'next');
  assert.equal(response.headers.get('x-robots-tag'), null);
  assert.ok(fetchCalls.some((url) => url.includes('/tenant/siteDetails')), 'the peek armed a background refresh');
});
