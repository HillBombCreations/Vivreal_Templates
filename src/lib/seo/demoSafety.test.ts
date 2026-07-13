import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which needs a resolvable specifier.
import { isDemoSite, getDemoSourceUrl } from './demoSafety.ts';

// demoSafety is the SEO demo-safety gate: a pre-cutover demo must be withheld
// from search indexes, and — critically — the DEFAULT must be indexable so no
// existing live customer site is ever accidentally deindexed.

const ENV_LIFECYCLE = process.env.SITE_LIFECYCLE;
const ENV_SOURCE = process.env.SITE_SOURCE_URL;
afterEach(() => {
  // Restore env after each case (tests mutate process.env to exercise fallbacks).
  if (ENV_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ENV_LIFECYCLE;
  if (ENV_SOURCE === undefined) delete process.env.SITE_SOURCE_URL;
  else process.env.SITE_SOURCE_URL = ENV_SOURCE;
});

test('FAIL-SAFE DEFAULT: no flag and no env ⇒ NOT a demo (indexable)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite(undefined), false);
  assert.equal(isDemoSite(null), false);
  assert.equal(isDemoSite({}), false, 'an existing site with no lifecycleState stays indexable');
  assert.equal(isDemoSite({ lifecycleState: undefined }), false);
});

test('an explicit lifecycleState=demo ⇒ demo (withheld from indexing)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite({ lifecycleState: 'demo' }), true);
});

test('lifecycleState=live ⇒ NOT a demo (indexable)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite({ lifecycleState: 'live' }), false);
});

test('SITE_LIFECYCLE env is a fallback when the doc has no flag', () => {
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(isDemoSite(undefined), true, 'env protects a demo before the doc flag is written');
  assert.equal(isDemoSite({}), true);
});

test('the doc flag takes precedence over the env fallback', () => {
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(isDemoSite({ lifecycleState: 'live' }), false, 'cutover (doc=live) wins over a stale env=demo');
});

test('a non-"demo" env value does not trigger the gate', () => {
  process.env.SITE_LIFECYCLE = 'live';
  assert.equal(isDemoSite(undefined), false);
  process.env.SITE_LIFECYCLE = 'production';
  assert.equal(isDemoSite(undefined), false);
});

test('getDemoSourceUrl: prefers the doc sourceUrl, falls back to env, else ""', () => {
  delete process.env.SITE_SOURCE_URL;
  assert.equal(getDemoSourceUrl({ sourceUrl: 'https://prospect.example' }), 'https://prospect.example');
  assert.equal(getDemoSourceUrl(undefined), '', 'unknown source ⇒ empty (caller skips canonical)');
  process.env.SITE_SOURCE_URL = 'https://env-source.example';
  assert.equal(getDemoSourceUrl(undefined), 'https://env-source.example', 'env fallback used when doc lacks it');
  assert.equal(getDemoSourceUrl({ sourceUrl: 'https://doc.example' }), 'https://doc.example', 'doc wins over env');
});
