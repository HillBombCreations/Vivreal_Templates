import { test } from 'node:test';
import assert from 'node:assert/strict';

// v5 search R4. Read off the SHIPPED `next.config.ts` (its real `headers()`,
// through Sentry's real build wrapper, as `scriptPolicy.test.ts` does). It
// used to be pinned from the config's source text; F608 (release C) moved the
// header's value into `src/lib/securityHeaders.ts`, and the shipped headers
// are what a browser gets whichever file holds the literal.
type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function everyRouteHsts(): Promise<string[]> {
  // The config's shape is checked below rather than trusted.
  const shipped: { default: { headers?: () => unknown } } = await import('../../../next.config.ts');
  assert.equal(typeof shipped.default.headers, 'function');
  const rules = (await shipped.default.headers!()) as HeaderRule[]; // checked to be a function above; read field by field below
  const rule = rules.find((r) => r.source === '/:path*');
  assert.ok(rule, 'the every-route rule exists');
  return rule.headers.filter((h) => h.key === 'Strict-Transport-Security').map((h) => h.value);
}

test('ALLOW: every response carries HSTS for one year', async () => {
  assert.deepEqual(await everyRouteHsts(), ['max-age=31536000']);
});

test('REFUSE: HSTS never claims subdomains or the preload list (vivreal.io is served by this app)', async () => {
  const [value] = await everyRouteHsts();
  assert.ok(value, 'the header value was read');
  assert.doesNotMatch(value, /includeSubDomains/i);
  assert.doesNotMatch(value, /preload/i);
});
