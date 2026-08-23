import { test } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`.
// Imports from siteOrigin.ts directly (not the ogImage.ts re-export), because
// ogImage.ts carries `import 'server-only'` — a Next.js build-time sentinel,
// not a real npm package, so it can't be resolved under plain `node --test`.
import { resolveIndexedOrigin, buildDetailUrl } from './siteOrigin.ts';

// resolveIndexedOrigin backs the indexed, crawler-cached surfaces (JSON-LD
// `url`, robots.txt `Sitemap:`, sitemap `<loc>`). It deliberately prefers a
// custom `domainName` over `domainInformation.live_url` — the reverse of
// resolveSiteOrigin's OG/metadata precedence — because `live_url` is briefly
// the raw amplifyapp host during Vivreal_EventHandler's deploy pipeline
// (getDefaultUrl) before domain association corrects it, while `domainName`
// is the durable, customer-authored value and is never an amplifyapp host.

test('a custom domainName wins over live_url (the fleet-observed steady state, and the un-corrected deploy window)', () => {
  const origin = resolveIndexedOrigin({
    domainName: 'wavesofgrainco.com',
    domainInformation: { live_url: 'https://main.d1234abcd.amplifyapp.com' },
  });
  assert.strictEqual(origin, 'https://wavesofgrainco.com');
});

test('a .vivreal.io subdomain site (no domainName) falls back to live_url', () => {
  const origin = resolveIndexedOrigin({
    domainName: undefined,
    domainInformation: { live_url: 'https://classichousephx.vivreal.io' },
  });
  assert.strictEqual(origin, 'https://classichousephx.vivreal.io');
});

test('neither domainName nor live_url ⇒ empty string', () => {
  assert.strictEqual(resolveIndexedOrigin({ domainName: undefined, domainInformation: undefined }), '');
  assert.strictEqual(resolveIndexedOrigin(null), '');
  assert.strictEqual(resolveIndexedOrigin(undefined), '');
});

test('NEXT_PUBLIC_SITE_URL env override wins over both', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://override.test/';
  try {
    const origin = resolveIndexedOrigin({
      domainName: 'wavesofgrainco.com',
      domainInformation: { live_url: 'https://classichousephx.vivreal.io' },
    });
    assert.strictEqual(origin, 'https://override.test');
  } finally {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test('trailing slashes are stripped from both domainName and live_url sources', () => {
  assert.strictEqual(
    resolveIndexedOrigin({ domainName: 'acme.test/', domainInformation: undefined }),
    'https://acme.test',
  );
  assert.strictEqual(
    resolveIndexedOrigin({ domainName: undefined, domainInformation: { live_url: 'https://sub.vivreal.io/' } }),
    'https://sub.vivreal.io',
  );
});

test('buildDetailUrl composes the resolved origin with slug/itemId', () => {
  const url = buildDetailUrl(
    { domainName: 'wavesofgrainco.com', domainInformation: undefined },
    'menu',
    'abc123',
  );
  assert.strictEqual(url, 'https://wavesofgrainco.com/menu/abc123');
});

test('buildDetailUrl returns undefined when no origin is known', () => {
  const url = buildDetailUrl({ domainName: undefined, domainInformation: undefined }, 'menu', 'abc123');
  assert.strictEqual(url, undefined);
});
