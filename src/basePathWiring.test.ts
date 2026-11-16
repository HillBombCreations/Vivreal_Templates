/**
 * TP-6, TP-7 (release B, F270): under the help site's base path, every fetch
 * to this app's own routes and every hand-built redirect carries `/help`.
 *
 * This process is the help app's build: `VIVREAL_SITE_BASE_PATH` is `/help`,
 * set before any module reads it. The REAL modules run: middleware through the
 * same loader `middleware.test.ts` uses (only `next/server` is stubbed), the
 * fetch callers against a recording `fetch`. Every other site builds with no
 * base, and each module's own suite pins that output unchanged.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

process.env.VIVREAL_SITE_BASE_PATH = '/help';
process.env.API_KEY = 'test-api-key';
process.env.SITE_ID = 'test-site-id';

register(new URL('./testSupport/middlewareLoader.mjs', import.meta.url).href);

const { middleware } = await import('./middleware.ts');
const { __resetEdgeSiteMapCacheForTests } = await import('./lib/edgeSiteMap.ts');
const { GET: faviconGet } = await import('./app/favicon.ico/route.ts');
const { llmsTxtRedirectResponseInit } = await import('./lib/llmsTxtRedirect.ts');
const { mcpGetAnswer } = await import('./lib/mcpBrowserGet.ts');
const { VIVREAL_MARKETING_SITE_ID } = await import('./lib/domains/publicSearch.ts');
const { buildPreviewEnableUrl } = await import('./lib/api/previewToken.ts');
const { requestDeliveryQuote } = await import('./lib/delivery/quoteClient.ts');
const { subscribeUser } = await import('./lib/api/subscribe/client.ts');
const { confirmOrder } = await import('./lib/confirmOrder.ts');

let fetchCalls: string[] = [];

/** A healthy edge map: two live pages and authored redirects, as a migrated site carries them. */
function useHealthyMap() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          pages: [{ slug: 'about' }, { slug: 'store' }],
          redirects: [
            { from: '/old', to: '/about', status: 301 },
            { from: '/about.php', to: '/about', status: 301 },
            { from: '/hostile', to: '//evil.example', status: 301 },
          ],
          siteDetails: { values: { lifecycleState: 'live' } },
        },
        error: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch; // the mock implements only the call shape middleware uses
}

/** Records every request and answers 200 `{}`. */
function useRecordingFetch() {
  globalThis.fetch = (async (input: string | URL | Request) => {
    fetchCalls.push(String(input instanceof Request ? input.url : input));
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch; // only the call shape the callers use
}

beforeEach(() => {
  __resetEdgeSiteMapCacheForTests();
  fetchCalls = [];
});

interface StubResponse {
  kind: 'response' | 'next' | 'redirect';
  status: number;
  headers: Headers;
}

/** The request Next hands middleware under basePath `/help`: `nextUrl.pathname` WITHOUT the base, `url` with it. */
async function run(pathname: string, search = ''): Promise<StubResponse> {
  const nextUrl = new URL(`${pathname}${search}`, 'https://vivreal.io');
  const request = {
    method: 'GET',
    url: `https://vivreal.io/help${pathname}${search}`,
    nextUrl,
    headers: new Headers({ 'user-agent': 'Mozilla/5.0' }),
    cookies: { has: () => false },
  };
  // Duck-typed to the members middleware.ts reads; a real NextRequest cannot be built outside Next.
  return (await middleware(request as never)) as unknown as StubResponse;
}

function locationOf(response: StubResponse): URL {
  return new URL(response.headers.get('location') ?? '', 'https://vivreal.io');
}

test('[TP-7 ALLOW] an authored redirect goes to /help/<target>, 301', async () => {
  useHealthyMap();
  const response = await run('/old');
  assert.equal(response.kind, 'redirect');
  assert.equal(response.status, 301);
  assert.equal(locationOf(response).origin, 'https://vivreal.io');
  assert.equal(locationOf(response).pathname, '/help/about');
});

test('[TP-7 ALLOW] a legacy .php redirect goes to /help/<target>, 308', async () => {
  useHealthyMap();
  const response = await run('/about.php');
  assert.equal(response.status, 308);
  assert.equal(locationOf(response).pathname, '/help/about');
});

test('[TP-7 REFUSE] a target resolving to another origin is still refused under the base', async () => {
  useHealthyMap();
  const response = await run('/hostile');
  assert.notEqual(response.kind, 'redirect');
  assert.equal(response.headers.get('location'), null);
});

test('[TP-7 ALLOW] a preview link goes to /help/api/preview/enable, back to the unbased page', async () => {
  useHealthyMap();
  const response = await run('/about', '?vivreal_preview=abc.0123ab');
  assert.equal(response.status, 307);
  const location = locationOf(response);
  assert.equal(location.pathname, '/help/api/preview/enable');
  assert.equal(location.searchParams.get('redirect'), '/about');
  assert.equal(buildPreviewEnableUrl('abc.0123ab', '/about').startsWith('/help/api/preview/enable?'), true);
});

test('[TP-7 ALLOW] hand-built Locations carry the base: favicon, llms.txt, the MCP connect page', () => {
  const favicon = faviconGet();
  assert.equal(favicon.status, 307);
  assert.equal(favicon.headers.get('location'), '/help/icon');
  assert.equal(llmsTxtRedirectResponseInit().headers.Location, '/help/llms.txt');
  const mcp = mcpGetAnswer('text/html', VIVREAL_MARKETING_SITE_ID);
  assert.equal(mcp.status, 307);
  assert.equal(mcp.status === 307 ? mcp.headers.Location : '', '/help/connect-your-ai');
});

test('[TP-6 ALLOW] fetches to this app\'s own routes go to /help/api/...', async () => {
  useRecordingFetch();
  await requestDeliveryQuote({} as Parameters<typeof requestDeliveryQuote>[0]); // forwarded whole; the shape is not read here
  await subscribeUser('a@b.co', 'collection-1');
  await confirmOrder('cs_test_basepath');
  assert.deepEqual(fetchCalls, ['/help/api/delivery-quote', '/help/api/subscribe', '/help/api/checkout/confirm']);
});

test('[TP-6 REFUSE] no fetch from those callers reaches an unbased /api/ path (the marketing app)', async () => {
  useRecordingFetch();
  await requestDeliveryQuote({} as Parameters<typeof requestDeliveryQuote>[0]); // as above
  await subscribeUser('a@b.co', 'collection-1');
  await confirmOrder('cs_test_basepath_2');
  for (const url of fetchCalls) assert.ok(!url.startsWith('/api/'), url);
});
