import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

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
type EnvKey = 'NEXT_PUBLIC_SENTRY_DSN' | 'SITE_ID';

async function shippedHeadersWith(env: Partial<Record<EnvKey, string>>): Promise<HeaderRule[]> {
  const keys: readonly EnvKey[] = ['NEXT_PUBLIC_SENTRY_DSN', 'SITE_ID'];
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
  const carrying = rules.filter((rule) => rule.headers.some((h) => h.key === 'Content-Security-Policy'));
  assert.equal(carrying.length, 1, 'one rule carries the frame rule');
  const require = createRequire(import.meta.url);
  const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match.js') as { getPathMatch: (path: string) => (pathname: string) => unknown };
  const matches = getPathMatch(carrying[0].source);
  assert.equal(getPathMatch('/api/:name')('/events'), false, 'control: the matcher does say no');
  for (const pathname of ['/', '/shop', '/contact', '/api/contact', '/api/checkout', '/checkoutsuccess', '/blog/first-loaf']) {
    assert.notEqual(matches(pathname), false, `${pathname} is covered`);
  }
});
