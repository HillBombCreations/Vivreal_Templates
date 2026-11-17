/**
 * T-268 (F268, release B, DC-B8): nothing may stop a site's Amplify default
 * host answering.
 *
 * `stable.<appId>.amplifyapp.com` is vivreal.io's own origin behind its
 * CloudFront distribution, which sends no Host (and from BR-19 the help
 * site's is too), and the site cache probe reads it. Blocking or redirecting
 * it was ruled out on 2026-11-13 (hotfix-plan-2026-11-13.md R-3).
 *
 * REFUSE: no request whose host ends in `.amplifyapp.com` is refused,
 * redirected or answered differently from the same request on the site's own
 * host. The REAL middleware runs both (the loader `middleware.test.ts` uses,
 * only `next/server` stubbed) over every shape it treats differently: pages,
 * a live slug, an authored redirect, a legacy extension, a scanner probe, a
 * preview link, metadata routes, an API route, a build asset; on a live site
 * and on a demo. The answers must match field for field, a redirect's target
 * compared as a path on the request's own host. The config cannot fork on host
 * either: no `host` condition and no `redirects()` in `next.config.ts`.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { register } from 'node:module';

register(new URL('./testSupport/middlewareLoader.mjs', import.meta.url).href);

process.env.API_KEY = 'test-api-key';
process.env.SITE_ID = 'test-site-id';
delete process.env.SITE_LIFECYCLE;

const { middleware } = await import('./middleware.ts');
const { __resetEdgeSiteMapCacheForTests } = await import('./lib/edgeSiteMap.ts');

const DEFAULT_HOST = 'stable.d1gukor54gwnrj.amplifyapp.com';
const OWN_HOST = 'vivreal.io';

const PATHS = [
  '/',
  '/about',
  '/about/item-1',
  '/old',
  '/about.php',
  '/wp-admin/install',
  '/.env',
  '/about?vivreal_preview=abc.0123ab',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/og/about',
  '/api/contact',
  '/_next/static/chunks/main-app.js',
];

function serve(lifecycleState: string) {
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        success: true,
        data: {
          pages: [{ slug: 'about' }],
          redirects: [
            { from: '/old', to: '/about', status: 301 },
            { from: '/about.php', to: '/about', status: 301 },
          ],
          siteDetails: { values: { lifecycleState } },
        },
        error: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch; // the mock implements only the call shape middleware uses
}

beforeEach(() => {
  __resetEdgeSiteMapCacheForTests();
});

type Answer = { kind: string; status: number; headers: Headers };

async function answer(host: string, pathAndQuery: string): Promise<Record<string, unknown>> {
  const url = new URL(pathAndQuery, `https://${host}`);
  const request = {
    method: 'GET',
    url: url.href,
    nextUrl: url,
    headers: new Headers({ host, 'user-agent': 'Mozilla/5.0' }),
    cookies: { has: () => false },
  };
  // Duck-typed to the members middleware.ts reads; a real NextRequest cannot be built outside Next.
  const response = (await middleware(request as never)) as unknown as Answer;
  const headers: Record<string, string> = {};
  for (const [key, value] of response.headers) {
    if (key === 'location') continue;
    headers[key] = value;
  }
  const raw = response.headers.get('location');
  let location: string | null = null;
  if (raw !== null) {
    const target = new URL(raw, url);
    // A redirect stays on the host it was asked on; compared as a path.
    assert.equal(target.host, host, `${pathAndQuery} on ${host} redirects to its own host`);
    location = `${target.pathname}${target.search}`;
  }
  return { kind: response.kind, status: response.status, location, headers };
}

for (const lifecycle of ['live', 'demo']) {
  test(`[T-268 REFUSE] (${lifecycle}) every request on the amplifyapp host is answered exactly as on the site's own host`, async () => {
    serve(lifecycle);
    await answer(OWN_HOST, '/about'); // warm the edge map, as any page view does
    for (const path of PATHS) {
      const own = await answer(OWN_HOST, path);
      const amplify = await answer(DEFAULT_HOST, path);
      assert.deepEqual(amplify, own, `${path} differs on ${DEFAULT_HOST}`);
    }
  });
}

test('[T-268 ALLOW] control: the same comparison does see a difference between two different paths', async () => {
  // Without this, deepEqual above could pass because answer() returns the
  // same thing for everything.
  serve('live');
  await answer(OWN_HOST, '/about');
  assert.notDeepEqual(await answer(DEFAULT_HOST, '/old'), await answer(DEFAULT_HOST, '/about'));
  assert.notDeepEqual(await answer(DEFAULT_HOST, '/.env'), await answer(DEFAULT_HOST, '/about'));
});

test('[T-268 REFUSE] the config has no host-conditioned rule and no redirects()', () => {
  const config = fs.readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
  const guard = fs.readFileSync(new URL('./lib/routerHeaderGuard.ts', import.meta.url), 'utf8');
  const keyFile = fs.readFileSync(new URL('./lib/indexnow/keyFileRewrite.ts', import.meta.url), 'utf8');
  for (const [name, text] of [['next.config.ts', config], ['routerHeaderGuard.ts', guard], ['keyFileRewrite.ts', keyFile]]) {
    assert.doesNotMatch(text, /type:\s*['"]host['"]/, `${name} has a host condition`);
  }
  assert.doesNotMatch(config, /\bredirects\s*\(/, 'next.config.ts has a redirects() block');
  assert.doesNotMatch(config, /amplifyapp/, 'next.config.ts names the amplifyapp host');
});
