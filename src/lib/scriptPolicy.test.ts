import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { cspAdmits, parsePolicy, type CspRequestKind } from './__testing__/cspMatch.ts';

/**
 * F173 (release A T-2, plan SW-A21): the report-only script policy on every
 * route, read off the SHIPPED `next.config.ts` (its real `headers()`, through
 * Sentry's real `withSentryConfig`), never off a copy of the module. The
 * expected value is SW-A21 written out byte for byte, so a drift in either the
 * policy or the endpoint shape is red here.
 *
 * SEC-1 F455 (vivreal-hq plan-sec-1.md, section 5): Vivreal's own two sites
 * get SEC-W2, still report-only; every other site keeps SW-A21 byte for byte.
 * Both are read the same way, with `SITE_ID` set as each site's build sets it,
 * never by calling the policy function directly.
 */

const PLANTED_DSN = 'https://0123456789abcdef0123456789abcdef@o4500000000000001.ingest.us.sentry.io/4500000000000002';
const SW_A21_VALUE =
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.clarity.ms https://*.clarity.ms https://plausible.io https://cdn.usefathom.com https://www.instagram.com; object-src 'none'; base-uri 'none'; form-action 'self'; report-uri https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/security/?sentry_key=0123456789abcdef0123456789abcdef";
/** SEC-W2 with the planted DSN, plan-sec-1.md 5.4, byte for byte. */
const SEC_W2_VALUE =
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com/gtag/js https://*.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.clarity.ms https://*.clarity.ms https://plausible.io https://cdn.usefathom.com https://www.instagram.com; connect-src 'self' https://collect.vivreal.io https://domains-api.vivreal.io https://o4500000000000001.ingest.us.sentry.io https://www.googletagmanager.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://stats.g.doubleclick.net https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://ad.doubleclick.net https://adservice.google.com https://*.clarity.ms https://c.bing.com; object-src 'none'; base-uri 'none'; form-action 'self'; report-uri https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/security/?sentry_key=0123456789abcdef0123456789abcdef";
const HEADER = 'Content-Security-Policy-Report-Only';
/** SEC-W4, written out here rather than imported, so a changed id in the code is red. */
const MARKETING_SITE_ID = '6a8d1146a4e1b46a9083e668';
const HELP_SITE_ID = '6aa1b1a896bf3f53d9beeaea';
const OWN_ORIGIN = 'https://vivreal.io';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };
type BuildEnvKey = 'NEXT_PUBLIC_SENTRY_DSN' | 'SITE_ID' | 'NEXT_PUBLIC_ANALYTICS_ENDPOINT' | 'NEXT_PUBLIC_DOMAINS_API' | 'VIVREAL_SCRIPT_POLICY';
type BuildEnv = Partial<Record<Exclude<BuildEnvKey, 'NEXT_PUBLIC_SENTRY_DSN'>, string>>;
const BUILD_ENV_KEYS: readonly BuildEnvKey[] = ['NEXT_PUBLIC_SENTRY_DSN', 'SITE_ID', 'NEXT_PUBLIC_ANALYTICS_ENDPOINT', 'NEXT_PUBLIC_DOMAINS_API', 'VIVREAL_SCRIPT_POLICY'];

function setEnv(key: BuildEnvKey, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/**
 * The shipped config's `headers()`, called with `NEXT_PUBLIC_SENTRY_DSN` set
 * to `dsn` (or unset) and the build settings in `env`. A setting not given is
 * UNSET for the call, so a `SITE_ID` in the shell running the tests can never
 * turn a customer row into an own-site one. Every value is restored after.
 */
async function shippedHeadersWith(dsn: string | undefined, env: BuildEnv = {}): Promise<HeaderRule[]> {
  const prior = BUILD_ENV_KEYS.map((key) => [key, process.env[key]] as const); // a fixed pair per key, restored below
  setEnv('NEXT_PUBLIC_SENTRY_DSN', dsn);
  for (const key of BUILD_ENV_KEYS) if (key !== 'NEXT_PUBLIC_SENTRY_DSN') setEnv(key, env[key]);
  try {
    // The config's shape is checked below rather than trusted.
    const shipped: { default: { headers?: () => unknown } } = await import('../../next.config.ts');
    assert.equal(typeof shipped.default.headers, 'function', 'the shipped config declares headers()');
    const rules = await shipped.default.headers!(); // checked to be a function on the line above
    assert.ok(Array.isArray(rules), 'headers() answers a list');
    return rules as HeaderRule[]; // a list, checked above; each rule is read field by field below
  } finally {
    for (const [key, value] of prior) setEnv(key, value);
  }
}

function policyValues(rules: HeaderRule[]): string[] {
  return rules.flatMap((rule) => rule.headers.filter((h) => h.key.toLowerCase() === HEADER.toLowerCase()).map((h) => h.value));
}

/** The one policy an own site's build sends, with the planted DSN. */
async function ownSiteValue(siteId: string = MARKETING_SITE_ID, env: BuildEnv = {}): Promise<string> {
  const values = policyValues(await shippedHeadersWith(PLANTED_DSN, { ...env, SITE_ID: siteId }));
  assert.equal(values.length, 1, 'control: the own site sends exactly one policy');
  return values[0];
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

test('ALLOW (SEC-T-1): an own site, marketing then help, carries SEC-W2 on every route, byte for byte', async () => {
  for (const siteId of [MARKETING_SITE_ID, HELP_SITE_ID]) {
    const rules = await shippedHeadersWith(PLANTED_DSN, { SITE_ID: siteId });
    const carrying = rules.filter((rule) => rule.headers.some((h) => h.key === HEADER));
    assert.equal(carrying.length, 1, `site ${siteId}: exactly one rule sends the policy`);
    assert.equal(carrying[0].source, '/:path*', `site ${siteId}: the every-route rule`);
    assert.deepEqual(policyValues(rules), [SEC_W2_VALUE], `site ${siteId}`);
    // The live proof's own check, here on the planted DSN: connect-src's Sentry entry is the report-uri host.
    const directives = parsePolicy(policyValues(rules)[0]);
    const reportHost = new URL(directives.get('report-uri')?.[0] ?? '').host;
    assert.ok(directives.get('connect-src')?.includes(`https://${reportHost}`), 'connect-src names the report-uri host');
  }
});

test('REFUSE (SEC-T-2): any other SITE_ID, near misses of the own ids included, keeps SW-A21 byte for byte', async () => {
  for (const siteId of [
    undefined,
    '',
    '   ',
    'preview',
    '6a0000000000000000000001',
    `${MARKETING_SITE_ID}.evil`,
    `x${MARKETING_SITE_ID}`,
    MARKETING_SITE_ID.toUpperCase(),
    `${HELP_SITE_ID}.evil`,
  ]) {
    const values = policyValues(await shippedHeadersWith(PLANTED_DSN, { SITE_ID: siteId }));
    assert.deepEqual(values, [SW_A21_VALUE], `SITE_ID ${JSON.stringify(siteId)} is a customer site`);
  }
});

test('REFUSE (SEC-T-3): no eval, strict-dynamic or nonce; the own value has no whole scheme, no wildcard Sentry or Google host, and no bare tag manager script host', async () => {
  const own = await ownSiteValue();
  const customer = policyValues(await shippedHeadersWith(PLANTED_DSN));
  assert.equal(customer.length, 1, 'control: the customer site sends one policy');
  for (const value of [own, customer[0]]) {
    assert.doesNotMatch(value, /'unsafe-eval'/);
    assert.doesNotMatch(value, /'strict-dynamic'/);
  }
  assert.doesNotMatch(own, /nonce-/i);
  const directives = parsePolicy(own);
  const sources = [...directives.values()].flat();
  assert.ok(sources.length > 0, 'control: the own value has sources to read');
  assert.ok(!sources.some((source) => /^[a-z][a-z0-9+.-]*:$/i.test(source)), 'no scheme source such as https:');
  const hosts = sources.map((source) => /^[a-z][a-z0-9+.-]*:\/\/([^/:]+)/i.exec(source)?.[1]?.toLowerCase() ?? '');
  assert.ok(hosts.includes('*.clarity.ms'), 'control: wildcard hosts are read');
  assert.ok(!hosts.some((host) => host.startsWith('*.') && host.endsWith('sentry.io')), 'no wildcard Sentry host: it admits any Sentry project');
  assert.ok(!hosts.includes('*.google.com'), 'no *.google.com: it admits anyone\'s Apps Script and Forms');
  const scriptSrc = directives.get('script-src') ?? [];
  assert.ok(!scriptSrc.includes('https://www.googletagmanager.com'), 'the bare tag manager host would admit /gtm.js');
  assert.ok(scriptSrc.includes('https://www.googletagmanager.com/gtag/js'), 'control: the narrowed tag source is there');
});

const SEC_T4_ROWS: ReadonlyArray<{ admit: boolean; kind: CspRequestKind; address: string }> = [
  { admit: true, kind: 'script', address: 'https://www.googletagmanager.com/gtag/js?id=G-PDC9TXR6Q2' },
  { admit: true, kind: 'connect', address: 'https://collect.vivreal.io/e' },
  { admit: true, kind: 'connect', address: 'https://domains-api.vivreal.io/public/availability?domain=a.com' },
  { admit: true, kind: 'connect', address: 'https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/envelope/' },
  { admit: true, kind: 'connect', address: 'https://region1.google-analytics.com/g/collect' },
  { admit: true, kind: 'connect', address: 'https://region1.analytics.google.com/g/collect' },
  { admit: true, kind: 'connect', address: 'https://s.clarity.ms/collect' },
  { admit: true, kind: 'connect', address: 'https://adservice.google.com/pagead/regclk' },
  { admit: false, kind: 'script', address: 'https://www.googletagmanager.com/gtm.js?id=GTM-XXXX' },
  { admit: false, kind: 'script', address: 'https://www.googletagmanager.com/gtag/destination?id=AW-1' },
  { admit: false, kind: 'script', address: 'https://1688360.cc/track.js' },
  { admit: false, kind: 'connect', address: 'https://1688360.cc/card.php' },
  { admit: false, kind: 'connect', address: 'https://o999.ingest.us.sentry.io/api/1/envelope/' },
  { admit: false, kind: 'connect', address: 'https://script.google.com/macros/s/x/exec' },
  { admit: false, kind: 'connect', address: 'https://docs.google.com/forms/d/x/formResponse' },
  { admit: false, kind: 'connect', address: 'https://x.execute-api.us-east-1.amazonaws.com/' },
];

// One test per row, so each row is red or green on its own assertion.
for (const row of SEC_T4_ROWS) {
  const directive = row.kind === 'script' ? 'script-src' : 'connect-src';
  test(`${row.admit ? 'ALLOW' : 'REFUSE'} (SEC-T-4): the own ${directive} ${row.admit ? 'admits' : 'refuses'} ${row.address}`, async () => {
    assert.equal(cspAdmits(await ownSiteValue(), row.kind, row.address, OWN_ORIGIN), row.admit);
  });
}

test('SEC-T-4 control: the matcher says yes and no by its own rules', () => {
  const policy = "script-src 'self' 'unsafe-inline' https://*.a.test https://b.test/x/ https://c.test/y.js https://d.test:8443; object-src 'none'";
  // No connect-src and no default-src admits any address; default-src then governs.
  assert.equal(cspAdmits(policy, 'connect', 'https://anywhere.test/up'), true);
  assert.equal(cspAdmits(`${policy}; default-src 'none'`, 'connect', 'https://anywhere.test/up'), false);
  assert.equal(cspAdmits(`${policy}; default-src https://anywhere.test`, 'connect', 'https://anywhere.test/up'), true);
  // `*.` is one or more labels, never the bare host.
  assert.equal(cspAdmits(policy, 'script', 'https://x.a.test/s.js'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://x.y.a.test/s.js'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://a.test/s.js'), false);
  assert.equal(cspAdmits(policy, 'script', 'https://xa.test/s.js'), false);
  // A path ending in `/` is a prefix, any other path is exact, the query is ignored.
  assert.equal(cspAdmits(policy, 'script', 'https://b.test/x/deep/s.js'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://b.test/xs.js'), false);
  assert.equal(cspAdmits(policy, 'script', 'https://c.test/y.js?v=2'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://c.test/y.jsx'), false);
  // Ports: none means the default, a named one must match; the scheme must match.
  assert.equal(cspAdmits(policy, 'script', 'https://d.test:8443/s.js'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://d.test/s.js'), false);
  assert.equal(cspAdmits(policy, 'script', 'https://x.a.test:444/s.js'), false);
  assert.equal(cspAdmits(policy, 'script', 'http://x.a.test/s.js'), false);
  // 'self' is the page origin; 'unsafe-inline' admits no address.
  assert.equal(cspAdmits(policy, 'script', 'https://site.test/s.js', 'https://site.test'), true);
  assert.equal(cspAdmits(policy, 'script', 'https://site.test/s.js'), false);
  // What it does not model, it refuses to answer.
  assert.throws(() => cspAdmits("script-src 'strict-dynamic'", 'script', 'https://a.test/s.js'), /strict-dynamic/);
  assert.throws(() => cspAdmits('script-src a.test', 'script', 'https://a.test/s.js'), /does not model/);
});

test('ALLOW (SEC-T-5): the own connect-src names the beacon and domain search origins the browser code resolves', async () => {
  const unset = parsePolicy(await ownSiteValue()).get('connect-src') ?? [];
  assert.ok(unset.includes('https://collect.vivreal.io'), 'the beacon default');
  assert.ok(unset.includes('https://domains-api.vivreal.io'), 'the domain search default');
  const moved =
    parsePolicy(
      await ownSiteValue(MARKETING_SITE_ID, {
        NEXT_PUBLIC_ANALYTICS_ENDPOINT: 'https://collect2.example.test/e',
        NEXT_PUBLIC_DOMAINS_API: 'https://search2.example.test',
      }),
    ).get('connect-src') ?? [];
  assert.ok(moved.includes('https://collect2.example.test'), 'the beacon override, as an origin');
  assert.ok(moved.includes('https://search2.example.test'), 'the domain search override, as an origin');
});

test('REFUSE (SEC-T-5): an override that is not an https address fails an own site while a customer site keeps SW-A21, and a good one replaces its default', async () => {
  const overrideKeys: ReadonlyArray<keyof BuildEnv> = ['NEXT_PUBLIC_ANALYTICS_ENDPOINT', 'NEXT_PUBLIC_DOMAINS_API'];
  for (const key of overrideKeys) {
    for (const bad of ['not a url', 'http://collect2.example.test/e', 'https://collect2;x.example.test/e']) {
      await assert.rejects(shippedHeadersWith(PLANTED_DSN, { SITE_ID: MARKETING_SITE_ID, [key]: bad }), /is not an absolute https address/, `${key}=${bad} fails an own site`);
      assert.deepEqual(policyValues(await shippedHeadersWith(PLANTED_DSN, { [key]: bad })), [SW_A21_VALUE], `${key}=${bad} leaves a customer site alone`);
    }
  }
  const moved =
    parsePolicy(
      await ownSiteValue(MARKETING_SITE_ID, {
        NEXT_PUBLIC_ANALYTICS_ENDPOINT: 'https://collect2.example.test/e',
        NEXT_PUBLIC_DOMAINS_API: 'https://search2.example.test',
      }),
    ).get('connect-src') ?? [];
  assert.ok(!moved.includes('https://collect.vivreal.io'), 'the beacon default is gone');
  assert.ok(!moved.includes('https://domains-api.vivreal.io'), 'the domain search default is gone');
  assert.ok(moved.length > 0, 'control: the overridden value has a connect-src');
});

test('REFUSE (SEC-T-6): an own site with no DSN, or a DSN that is not one, sends no policy header either', async () => {
  for (const dsn of [undefined, '', '   ', 'not a dsn', 'http://0123abcd@o1.ingest.sentry.io/42', 'https://o1.ingest.sentry.io/42', 'https://key@o1.ingest.sentry.io/prefix/42', 'https://key@o1.ingest.sentry.io/notanumber', 'https://ke;y@o1.ingest.sentry.io/42']) {
    const rules = await shippedHeadersWith(dsn, { SITE_ID: MARKETING_SITE_ID });
    assert.deepEqual(policyValues(rules), [], `DSN ${JSON.stringify(dsn)} sends no policy`);
    assert.ok(rules.some((rule) => rule.headers.some((h) => h.key === 'Strict-Transport-Security')), 'control: the other headers stay');
  }
});

/*
 * PRL-RA11 (release C; vivreal-hq docs/projects/next-release-C/
 * design-script-policy-switch.md SP-1 to SP-3, T-SP-1 to T-SP-4) and F478
 * (Templates #231 review notes): the build setting VIVREAL_SCRIPT_POLICY
 * switches the policy from watching to blocking, per app, with no second
 * deployment. Read off the shipped config like every test above.
 */

const ENDPOINT = 'https://o4500000000000001.ingest.us.sentry.io/api/4500000000000002/security/?sentry_key=0123456789abcdef0123456789abcdef';
const FRAME = "frame-ancestors 'self'";
const SW_A21_DIRECTIVES = SW_A21_VALUE.slice(0, SW_A21_VALUE.indexOf('; report-uri '));
const SEC_W2_DIRECTIVES = SEC_W2_VALUE.slice(0, SEC_W2_VALUE.indexOf('; report-uri '));
const BASE = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

async function everyRouteHeaders(dsn: string | undefined, env: BuildEnv = {}): Promise<Array<{ key: string; value: string }>> {
  const rules = await shippedHeadersWith(dsn, env);
  const rule = rules.find((r) => r.source === '/:path*');
  assert.ok(rule, 'the every-route rule exists');
  return rule.headers;
}

const enforcedValues = (headers: Array<{ key: string; value: string }>) =>
  headers.filter((h) => h.key.toLowerCase() === 'content-security-policy').map((h) => h.value);

const WATCHING = [undefined, 'report-only', ' REPORT-ONLY '];
const SITES = [
  { name: 'a customer site', siteId: '6a0000000000000000000001', directives: SW_A21_DIRECTIVES, environment: 'csp-site' },
  { name: 'an own site', siteId: MARKETING_SITE_ID, directives: SEC_W2_DIRECTIVES, environment: 'csp-own' },
  { name: 'the help site', siteId: HELP_SITE_ID, directives: SEC_W2_DIRECTIVES, environment: 'csp-own' },
];

for (const site of SITES) {
  test(`ALLOW (T-SP-1, F478 2): watching, ${site.name}'s header list is exactly HSTS, F608's headers and today's report-only policy`, async () => {
    for (const setting of WATCHING) {
      const headers = await everyRouteHeaders(PLANTED_DSN, { SITE_ID: site.siteId, VIVREAL_SCRIPT_POLICY: setting });
      assert.deepEqual(headers, [
        ...BASE,
        { key: 'Content-Security-Policy', value: FRAME },
        { key: HEADER, value: `${site.directives}; report-uri ${ENDPOINT}` },
      ], `setting ${JSON.stringify(setting)}`);
    }
  });

  test(`ALLOW (T-SP-2, F478 2): enforcing, ${site.name} sends one blocking policy with the frame rule and the ${site.environment} tag`, async () => {
    for (const setting of ['enforce', ' ENFORCE ', 'Enforce']) {
      const headers = await everyRouteHeaders(PLANTED_DSN, { SITE_ID: site.siteId, VIVREAL_SCRIPT_POLICY: setting });
      assert.deepEqual(headers, [
        ...BASE,
        { key: 'Content-Security-Policy', value: `${site.directives}; ${FRAME}; report-uri ${ENDPOINT}&sentry_environment=${site.environment}` },
      ], `setting ${JSON.stringify(setting)}`);
    }
  });
}

test('REFUSE (T-SP-1): while watching, no enforced policy holds a script rule, and no report carries an environment tag', async () => {
  for (const site of SITES) {
    for (const setting of WATCHING) {
      const headers = await everyRouteHeaders(PLANTED_DSN, { SITE_ID: site.siteId, VIVREAL_SCRIPT_POLICY: setting });
      const enforced = enforcedValues(headers);
      assert.equal(enforced.length, 1, 'control: the frame rule is the one enforced entry');
      for (const value of enforced) assert.doesNotMatch(value, /script-src/, 'watching blocks no script');
      for (const h of headers) assert.doesNotMatch(h.value, /sentry_environment/, 'a watched report is filed under no environment');
    }
  }
});

test('REFUSE (T-SP-2): while enforcing, no report-only entry is left and there are never two enforced entries', async () => {
  for (const site of SITES) {
    const headers = await everyRouteHeaders(PLANTED_DSN, { SITE_ID: site.siteId, VIVREAL_SCRIPT_POLICY: 'enforce' });
    assert.deepEqual(headers.filter((h) => h.key === HEADER), [], 'one report per block: the watch-only header goes');
    assert.equal(enforcedValues(headers).length, 1, 'Next keeps only the last rule per name, so there is exactly one');
    assert.match(enforcedValues(headers)[0], /script-src/, 'control: the one entry is the script policy');
  }
});

test('REFUSE (T-SP-3): a misspelt or blank setting fails the build, naming the setting', async () => {
  for (const bad of ['enforced', 'on', 'true', '1', '', '   ', 'block', 'report_only']) {
    await assert.rejects(
      everyRouteHeaders(PLANTED_DSN, { SITE_ID: '6a0000000000000000000001', VIVREAL_SCRIPT_POLICY: bad }),
      /VIVREAL_SCRIPT_POLICY/,
      `${JSON.stringify(bad)} fails the build`,
    );
  }
});

test('ALLOW (T-SP-4): no DSN sends no script policy in either mode, and the frame rule stays', async () => {
  for (const setting of [undefined, 'report-only', 'enforce']) {
    for (const siteId of ['6a0000000000000000000001', MARKETING_SITE_ID]) {
      const headers = await everyRouteHeaders(undefined, { SITE_ID: siteId, VIVREAL_SCRIPT_POLICY: setting });
      assert.deepEqual(headers, [...BASE, { key: 'Content-Security-Policy', value: FRAME }], `setting ${JSON.stringify(setting)}, site ${siteId}`);
    }
  }
});

test('REFUSE (T-SP-4, F478 5): a DSN whose host holds a `;`, or with a path prefix, sends no script policy in either mode', async () => {
  for (const dsn of ['https://key@o1;x.ingest.sentry.io/42', 'https://key@o1.ingest.sentry.io;x/42', 'https://key@o1.ingest.sentry.io/prefix/42']) {
    for (const setting of [undefined, 'enforce']) {
      const headers = await everyRouteHeaders(dsn, { SITE_ID: '6a0000000000000000000001', VIVREAL_SCRIPT_POLICY: setting });
      assert.deepEqual(headers, [...BASE, { key: 'Content-Security-Policy', value: FRAME }], `DSN ${dsn}, setting ${JSON.stringify(setting)}`);
    }
  }
  // Control: the same DSN shape with a clean host does send the policy.
  const clean = await everyRouteHeaders('https://key@o1.ingest.sentry.io/42', { SITE_ID: '6a0000000000000000000001' });
  assert.equal(clean.filter((h) => h.key === HEADER).length, 1);
});

test('F478 4: the customer script list and the own script list are the same list but for the narrowed Google tag', async () => {
  const customer = parsePolicy((await everyRouteHeaders(PLANTED_DSN, { SITE_ID: '6a0000000000000000000001' })).find((h) => h.key === HEADER)?.value ?? '').get('script-src') ?? [];
  const own = parsePolicy(await ownSiteValue()).get('script-src') ?? [];
  assert.ok(customer.length > 5, 'control: the customer list was read');
  assert.deepEqual(
    own,
    customer.map((source) => (source === 'https://www.googletagmanager.com' ? 'https://www.googletagmanager.com/gtag/js' : source)),
  );
});
