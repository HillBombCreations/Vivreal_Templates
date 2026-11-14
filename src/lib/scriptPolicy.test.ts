import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

/**
 * F173 (release A T-2, plan SW-A21): the report-only script policy on every
 * route, read off the SHIPPED `next.config.ts` (its real `headers()`, through
 * Sentry's real `withSentryConfig`), never off a copy of the module. The
 * expected value is SW-A21 written out byte for byte, so a drift in either the
 * policy or the endpoint shape is red here.
 */

const PLANTED_DSN = 'https://0123456789abcdef0123456789abcdef@o4500000000000001.ingest.us.sentry.io/4500000000000002';
const SW_A21_VALUE =
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.clarity.ms https://*.clarity.ms https://plausible.io https://cdn.usefathom.com https://www.instagram.com; object-src 'none'; base-uri 'none'; form-action 'self'; report-uri https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/security/?sentry_key=0123456789abcdef0123456789abcdef";
const HEADER = 'Content-Security-Policy-Report-Only';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

/** The shipped config's `headers()`, called with `NEXT_PUBLIC_SENTRY_DSN` set to `dsn` (or unset), the env restored after. */
async function shippedHeadersWith(dsn: string | undefined): Promise<HeaderRule[]> {
  const prior = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = dsn;
  try {
    // The config's shape is checked below rather than trusted.
    const shipped: { default: { headers?: () => unknown } } = await import('../../next.config.ts');
    assert.equal(typeof shipped.default.headers, 'function', 'the shipped config declares headers()');
    const rules = await shipped.default.headers!(); // checked to be a function on the line above
    assert.ok(Array.isArray(rules), 'headers() answers a list');
    return rules as HeaderRule[]; // a list, checked above; each rule is read field by field below
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = prior;
  }
}

function policyValues(rules: HeaderRule[]): string[] {
  return rules.flatMap((rule) => rule.headers.filter((h) => h.key.toLowerCase() === HEADER.toLowerCase()).map((h) => h.value));
}

test('ALLOW (T-2): every route carries SW-A21 byte for byte, its endpoint built from the DSN', async () => {
  const rules = await shippedHeadersWith(PLANTED_DSN);
  const carrying = rules.filter((rule) => rule.headers.some((h) => h.key === HEADER));
  assert.equal(carrying.length, 1, `exactly one rule sends the policy, got ${JSON.stringify(rules)}`);
  assert.equal(carrying[0].source, '/:path*', 'the every-route rule');
  assert.deepEqual(policyValues(rules), [SW_A21_VALUE]);
  // Control: the HSTS header on the same rule is unchanged.
  assert.ok(carrying[0].headers.some((h) => h.key === 'Strict-Transport-Security' && h.value === 'max-age=31536000'));
  // The rule's source matches every route, by Next's own matcher.
  const require = createRequire(import.meta.url);
  const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match.js') as { getPathMatch: (path: string) => (pathname: string) => unknown };
  const matches = getPathMatch(carrying[0].source);
  assert.equal(getPathMatch('/api/:name')('/events'), false, 'control: the matcher does say no');
  for (const pathname of ['/', '/events', '/shows/6a0000000000000000000001', '/api/checkout', '/og/home', '/feeds/schedule.ics']) {
    assert.notEqual(matches(pathname), false, `${pathname} is covered`);
  }
});

test('REFUSE (T-2): no DSN, or a DSN that is not one, gives no policy header at all', async () => {
  for (const dsn of [undefined, '', '   ', 'not a dsn', 'http://0123abcd@o1.ingest.sentry.io/42', 'https://o1.ingest.sentry.io/42', 'https://key@o1.ingest.sentry.io/prefix/42', 'https://key@o1.ingest.sentry.io/notanumber', 'https://ke;y@o1.ingest.sentry.io/42']) {
    const rules = await shippedHeadersWith(dsn);
    assert.deepEqual(policyValues(rules), [], `DSN ${JSON.stringify(dsn)} sends no policy`);
    assert.ok(rules.some((rule) => rule.headers.some((h) => h.key === 'Strict-Transport-Security')), 'control: the other headers stay');
  }
});

test('REFUSE (T-2): the policy never carries a nonce, and never a DSN secret', async () => {
  const values = [
    ...policyValues(await shippedHeadersWith(PLANTED_DSN)),
    ...policyValues(await shippedHeadersWith('https://publickey1@o1.ingest.sentry.io/42')),
    ...policyValues(await shippedHeadersWith('https://publickey2:secretpart@o1.ingest.sentry.io/43')),
  ];
  assert.equal(values.length, 3, 'control: all three DSNs send the policy');
  for (const value of values) {
    assert.doesNotMatch(value, /nonce-/i, 'a cached page carries no per-request nonce');
    assert.doesNotMatch(value, /secretpart/, 'a legacy DSN secret never reaches a public header');
  }
  assert.match(values[2], /sentry_key=publickey2$/, 'the public key alone');
});

test('U2 (T-2): next build loads the .env files BEFORE it evaluates next.config.ts, so the DSN is there', () => {
  // The DSN reaches a build through `.env.production` as well as the shell. The
  // policy is read when the config is evaluated, so the order is load-bearing.
  // This reads the installed Next's own build entry and goes red when a bump moves it.
  const build = fs.readFileSync(new URL('../../node_modules/next/dist/build/index.js', import.meta.url), 'utf8');
  const dotenv = build.indexOf("traceChild('load-dotenv')");
  const config = build.indexOf("traceChild('load-next-config')");
  assert.ok(dotenv > 0, 'found the dotenv step');
  assert.ok(config > 0, 'found the config step');
  assert.ok(dotenv < config, 'dotenv is loaded first');
  assert.match(build.slice(dotenv, dotenv + 200), /loadEnvConfig\)\(dir/, 'the dotenv step loads the project directory');
});
