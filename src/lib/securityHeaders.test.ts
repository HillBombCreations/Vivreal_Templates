import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match.js') as {
  getPathMatch: (path: string, options?: { strict?: boolean; removeUnnamedParams?: boolean }) => (pathname: string) => unknown;
};

/**
 * F608 (release C, F165-G1-11, SW-C8): the frame rule and its header set, read
 * off the SHIPPED `next.config.ts` (its real `headers()`, through Sentry's real
 * `withSentryConfig`), with the build settings each site's build sets. The
 * expected values are written out here, so a drift in the code is red.
 */

const PLANTED_DSN = 'https://0123456789abcdef0123456789abcdef@o4500000000000001.ingest.us.sentry.io/4500000000000002';
const MARKETING_SITE_ID = '6a8d1146a4e1b46a9083e668';
const CUSTOMER_SITE_ID = '6a0000000000000000000a01';

type Header = { key: string; value: string };
type HeaderRule = { source: string; headers: Header[] };
type EnvKey = 'NEXT_PUBLIC_SENTRY_DSN' | 'SITE_ID' | 'VIVREAL_SCRIPT_POLICY';

async function shippedHeadersWith(env: Partial<Record<EnvKey, string>>): Promise<HeaderRule[]> {
  const keys: readonly EnvKey[] = ['NEXT_PUBLIC_SENTRY_DSN', 'SITE_ID', 'VIVREAL_SCRIPT_POLICY'];
  const prior = keys.map((key) => [key, process.env[key]] as const);
  for (const key of keys) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  try {
    // The config's shape is checked below rather than trusted.
    const shipped: { default: { headers?: () => unknown } } = await import('../../next.config.ts');
    assert.equal(typeof shipped.default.headers, 'function');
    const rules = await shipped.default.headers!(); // checked to be a function on the line above
    assert.ok(Array.isArray(rules));
    return rules as HeaderRule[]; // a list, checked above; each rule is read field by field below
  } finally {
    for (const [key, value] of prior) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** The every-route rule's headers. */
function everyRoute(rules: HeaderRule[]): Header[] {
  const rule = rules.find((r) => r.source === '/:path*');
  assert.ok(rule, 'the every-route rule exists');
  return rule.headers;
}

const named = (headers: Header[], key: string) => headers.filter((h) => h.key.toLowerCase() === key.toLowerCase());

const CASES: ReadonlyArray<{ name: string; env: Partial<Record<EnvKey, string>> }> = [
  { name: 'a customer site with a DSN', env: { NEXT_PUBLIC_SENTRY_DSN: PLANTED_DSN, SITE_ID: CUSTOMER_SITE_ID } },
  { name: 'an own site with a DSN', env: { NEXT_PUBLIC_SENTRY_DSN: PLANTED_DSN, SITE_ID: MARKETING_SITE_ID } },
  { name: 'a site with no DSN', env: { SITE_ID: CUSTOMER_SITE_ID } },
  { name: 'a build with nothing set', env: {} },
];

for (const { name, env } of CASES) {
  test(`ALLOW (F608): ${name} sends the frame rule, nosniff and the referrer policy on every route`, async () => {
    const headers = everyRoute(await shippedHeadersWith(env));
    assert.deepEqual(named(headers, 'X-Content-Type-Options'), [{ key: 'X-Content-Type-Options', value: 'nosniff' }]);
    assert.deepEqual(named(headers, 'Referrer-Policy'), [{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }]);
    assert.deepEqual(named(headers, 'Strict-Transport-Security'), [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]);
    const enforced = named(headers, 'Content-Security-Policy');
    assert.equal(enforced.length, 1, 'exactly one enforced policy entry (Next keeps only the last rule per name)');
    assert.match(enforced[0].value, /(^|; )frame-ancestors 'self'(;|$)/);
  });

  test(`REFUSE (F608): ${name} never lets another website frame it, and never puts the frame rule in the watch-only header`, async () => {
    const headers = everyRoute(await shippedHeadersWith(env));
    const enforced = named(headers, 'Content-Security-Policy');
    const frame = enforced.flatMap((h) => h.value.split(';').map((d) => d.trim()).filter((d) => d.startsWith('frame-ancestors')));
    assert.deepEqual(frame, ["frame-ancestors 'self'"], 'one frame directive, self only: no *, no https:, no other host');
    for (const watching of named(headers, 'Content-Security-Policy-Report-Only')) {
      assert.doesNotMatch(watching.value, /frame-ancestors/, 'a watch-only frame rule blocks nothing');
    }
  });
}

test('ALLOW (F608): the rule covers every route, by Next\'s own matcher', async () => {
  const rules = await shippedHeadersWith({ NEXT_PUBLIC_SENTRY_DSN: PLANTED_DSN, SITE_ID: CUSTOMER_SITE_ID });
  // Review C-TPL B1: the picture routes' rules carry a policy too (tested below); one every-route rule carries the frame rule.
  const carrying = rules.filter((rule) => rule.source === '/:path*' && rule.headers.some((h) => h.key === 'Content-Security-Policy'));
  assert.equal(carrying.length, 1, 'one every-route rule carries the frame rule');
  const matches = getPathMatch(carrying[0].source);
  assert.equal(getPathMatch('/api/:name')('/events'), false, 'control: the matcher does say no');
  for (const pathname of ['/', '/shop', '/contact', '/api/contact', '/api/checkout', '/checkoutsuccess', '/blog/first-loaf']) {
    assert.notEqual(matches(pathname), false, `${pathname} is covered`);
  }
});

/**
 * Review C-TPL pass 1, B1: the header a served response gets, resolved as Next resolves it. Next tests every header
 * rule in order (`buildCustomRoute` with `strict` and `removeUnnamedParams`, `router-utils/filesystem.js`), a later
 * rule replaces an earlier one's value of the same name (`resolve-routes.js`), and a route handler's own header of that
 * name is then DROPPED (`send-response.js`: it is copied only when the name is absent). So the last matching rule is
 * what the browser reads, whatever the route itself sets.
 */
function resolvedHeader(rules: HeaderRule[], pathname: string, key: string): string | undefined {
  let value: string | undefined;
  for (const rule of rules) {
    if (getPathMatch(rule.source, { strict: true, removeUnnamedParams: true })(pathname) === false) continue;
    for (const h of rule.headers) if (h.key.toLowerCase() === key.toLowerCase()) value = h.value;
  }
  return value;
}

const PICTURE_PATHS = [
  '/img/shop/6a1f2dca0c050cbd8c075bb1',
  '/img/shop/6a1f2dca0c050cbd8c075bb1/loaf.svg',
  '/brand/logo',
  '/og/about',
  '/og/shop/6a1f2dca0c050cbd8c075bb1',
];
const MODES: ReadonlyArray<{ name: string; env: Partial<Record<EnvKey, string>> }> = [
  { name: 'watching (the default)', env: { NEXT_PUBLIC_SENTRY_DSN: PLANTED_DSN, SITE_ID: CUSTOMER_SITE_ID } },
  { name: 'enforcing', env: { NEXT_PUBLIC_SENTRY_DSN: PLANTED_DSN, SITE_ID: CUSTOMER_SITE_ID, VIVREAL_SCRIPT_POLICY: 'enforce' } },
  { name: 'no DSN', env: { SITE_ID: CUSTOMER_SITE_ID } },
];
const directives = (value: string | undefined) => (value ?? '').split(';').map((d) => d.trim()).filter(Boolean);

for (const { name, env } of MODES) {
  test(`REFUSE (B1): ${name}, a picture route's served policy never loses the sandbox (an SVG on the site's own address could run script)`, async () => {
    const rules = await shippedHeadersWith(env);
    for (const pathname of PICTURE_PATHS) {
      const policy = directives(resolvedHeader(rules, pathname, 'Content-Security-Policy'));
      assert.ok(policy.includes('sandbox'), `${pathname}: the served policy has no sandbox: ${policy.join('; ')}`);
      assert.ok(policy.includes("default-src 'none'"), `${pathname}: the served policy loads more than nothing: ${policy.join('; ')}`);
      assert.ok(!policy.some((d) => d.startsWith('script-src')), `${pathname}: a script source on a picture route`);
    }
  });

  test(`ALLOW (B1): ${name}, a picture route keeps the frame rule, and a page keeps the every-route policy`, async () => {
    const rules = await shippedHeadersWith(env);
    for (const pathname of PICTURE_PATHS) {
      assert.equal(
        resolvedHeader(rules, pathname, 'Content-Security-Policy'),
        "default-src 'none'; style-src 'unsafe-inline'; sandbox; frame-ancestors 'self'",
        pathname,
      );
    }
    const everyRoutePolicy = named(everyRoute(rules), 'Content-Security-Policy')[0].value;
    // '/' is left to the served-build read: Next's strict matcher answers no for it here, yet serves the rule there.
    for (const pathname of ['/shop', '/imagery', '/brand', '/brand/logo-old', '/api/contact', '/checkoutsuccess']) {
      assert.equal(resolvedHeader(rules, pathname, 'Content-Security-Policy'), everyRoutePolicy, `${pathname} keeps the every-route policy`);
    }
  });
}

test("CONTROL (B1): the resolver takes the LAST matching rule, and the route's own policy is the one the rule restates", async () => {
  const planted: HeaderRule[] = [
    { source: '/:path*', headers: [{ key: 'Content-Security-Policy', value: 'first' }] },
    { source: '/img/:path*', headers: [{ key: 'content-security-policy', value: 'second' }] },
  ];
  assert.equal(resolvedHeader(planted, '/img/a/b', 'Content-Security-Policy'), 'second');
  assert.equal(resolvedHeader(planted, '/about', 'Content-Security-Policy'), 'first');
  const { IMAGE_SAFETY_HEADERS } = await import('./media/stableImage.ts');
  assert.equal(IMAGE_SAFETY_HEADERS['Content-Security-Policy'], "default-src 'none'; style-src 'unsafe-inline'; sandbox");
});
