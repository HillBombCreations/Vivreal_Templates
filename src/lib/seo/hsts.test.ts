import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// v5 search R4. `next.config.ts` imports Sentry's build wrapper and cannot be
// loaded under the plain-Node runner, so the header is pinned from source,
// the same way `renderMode.test.ts` pins `expireTime`.
const configSource = fs.readFileSync(new URL('../../../next.config.ts', import.meta.url), 'utf8');

test('ALLOW: every response carries HSTS for one year', () => {
  assert.match(configSource, /source: '\/:path\*',/);
  assert.match(configSource, /\{ key: 'Strict-Transport-Security', value: 'max-age=31536000' \}/);
});

test('REFUSE: HSTS never claims subdomains or the preload list (vivreal.io is served by this app)', () => {
  const value = /key: 'Strict-Transport-Security', value: '([^']*)'/.exec(configSource)?.[1];
  assert.ok(value, 'the header value was parsed');
  assert.doesNotMatch(value, /includeSubDomains/i);
  assert.doesNotMatch(value, /preload/i);
});
