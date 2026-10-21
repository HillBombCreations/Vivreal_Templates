import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import nextConfig from '../../next.config.ts';

/**
 * The Turbopack filesystem caches persist the whole build env (next.config.ts,
 * the `experimental` block, says why). These tests read the SHIPPED config,
 * the default export after `withSentryConfig`, so a wrapper that dropped
 * `experimental` would fail here too, not only a deleted line.
 */

const CACHE_KEYS = ['turbopackFileSystemCacheForBuild', 'turbopackFileSystemCacheForDev'] as const;

// The `experimental` shape on NextConfig does not list every key the
// installed Next accepts, so read it as a plain record.
const experimental = (nextConfig.experimental ?? {}) as Record<string, unknown>;

for (const key of CACHE_KEYS) {
  test(`REFUSE: experimental.${key} is exactly false (absent means Next's default, true)`, () => {
    assert.ok(key in experimental, `next.config.ts must set experimental.${key}`);
    assert.equal(experimental[key], false);
  });
}

test('ALLOW: the installed Next still recognises both key names, so false actually turns the cache off', () => {
  const require = createRequire(import.meta.url);
  // next ships config-shared.js as CommonJS without types for this path.
  const { defaultConfig } = require('next/dist/server/config-shared.js') as {
    defaultConfig: { experimental: Record<string, unknown> };
  };
  for (const key of CACHE_KEYS) {
    assert.equal(
      typeof defaultConfig.experimental[key],
      'boolean',
      `next renamed or dropped experimental.${key}; find the new key before trusting this config`,
    );
  }
});
