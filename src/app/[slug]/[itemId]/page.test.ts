import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// page.tsx contains JSX, so `node --experimental-strip-types` cannot load it at
// all (.tsx is unsupported by that loader regardless of content). Every other
// gate in this change was moved into a plain .ts module precisely so it could
// be tested by CALLING it; this one cannot be, because the five JSON-LD shapes
// are inline branches of a 900-line route module and extracting them is a far
// larger change than the wiring it would cover. `buildDetailUrl`'s own
// behaviour is tested for real in src/lib/og/siteOrigin.test.ts; this file
// pins only that all five call sites reach it.

test('all five detail JSON-LD shapes resolve their URL through the shared helper', () => {
  const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  const calls = source.match(/buildDetailUrl\(siteData, slug, itemId\)/g) ?? [];
  assert.equal(calls.length, 5, 'each of the five schema shapes resolves its detail URL once');
});

test('no detail URL is still hand-built from a raw domainName', () => {
  // The pre-change form. Hand-built URLs skipped the demo gate, the HTTPS-origin
  // allowlist and the amplifyapp refusal, and emitted nothing at all for the
  // subdomain-only sites that are the fleet majority.
  const source = fs.readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /https:\/\/\$\{siteData\.domainName\}/);
});
