import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSiteOrigin, buildDetailUrl } from './siteOrigin.ts';

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SITE_URL;
const ORIGINAL_LIFECYCLE = process.env.SITE_LIFECYCLE;
afterEach(() => {
  if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL_ENV;
  if (ORIGINAL_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ORIGINAL_LIFECYCLE;
});

test('canonical resolver uses persisted apex before env, physical live URL, and legacy domain', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example/';
  assert.equal(resolveSiteOrigin({
    canonicalUrl: 'https://vivreal.io/',
    domainInformation: { live_url: 'https://next.vivreal.io' },
    domainName: 'legacy.example',
  }), 'https://vivreal.io');
  assert.equal(resolveSiteOrigin({ domainInformation: { live_url: 'https://next.vivreal.io' } }), 'https://env.example');
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(resolveSiteOrigin({ domainInformation: { live_url: 'https://next.vivreal.io/' } }), 'https://next.vivreal.io');
  assert.equal(resolveSiteOrigin({ domainName: 'legacy.example/' }), 'https://legacy.example');
  assert.equal(resolveSiteOrigin({}), '');
});

test('SEO demo-safety: a demo site never resolves its origin from a populated canonicalUrl', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  // The cutover endpoint can write canonicalUrl BEFORE lifecycleState flips to
  // 'live' (write-ahead so Stage 6 can confirm it pre-mutation) — a demo site
  // must never resolve to that pre-cutover value, live_url/domainName only.
  assert.equal(
    resolveSiteOrigin({
      lifecycleState: 'demo',
      canonicalUrl: 'https://vivreal.io',
      domainInformation: { live_url: 'https://demo-sub.vivreal.io' },
      domainName: 'legacy.example',
    }),
    'https://demo-sub.vivreal.io',
    'falls through to live_url, ignoring the persisted canonicalUrl entirely',
  );
  assert.equal(
    resolveSiteOrigin({ lifecycleState: 'demo', canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }),
    'https://legacy.example',
    'falls through to domainName when live_url is absent too',
  );
  // Same gate as isDemoSite's env fallback: an in-flight demo build protected
  // by SITE_LIFECYCLE alone (doc flag not yet written) is covered too.
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(
    resolveSiteOrigin({ canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }),
    'https://legacy.example',
  );
});

test('a malformed, relative, or non-https canonicalUrl is rejected and falls back rather than emitting garbage', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(resolveSiteOrigin({ canonicalUrl: 'not-a-url', domainName: 'legacy.example' }), 'https://legacy.example');
  assert.equal(resolveSiteOrigin({ canonicalUrl: '/relative/path', domainName: 'legacy.example' }), 'https://legacy.example');
  assert.equal(resolveSiteOrigin({ canonicalUrl: 'http://insecure.example', domainName: 'legacy.example' }), 'https://legacy.example');
  assert.equal(resolveSiteOrigin({ canonicalUrl: 'javascript:alert(1)', domainName: 'legacy.example' }), 'https://legacy.example');
  assert.equal(resolveSiteOrigin({ canonicalUrl: '   ', domainName: 'legacy.example' }), 'https://legacy.example');
  // A well-formed value still wins over every fallback.
  assert.equal(resolveSiteOrigin({ canonicalUrl: 'https://vivreal.io', domainName: 'legacy.example' }), 'https://vivreal.io');
});

test('all detail schema shapes share the resolved canonical URL without changing route serialization', () => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example';
  const data = { canonicalUrl: 'https://vivreal.io' };
  for (const shape of ['shows', 'team', 'products', 'scoped-item', 'menu-item']) {
    assert.equal(
      buildDetailUrl(data, `${shape} & more`, 'item/1'),
      `https://vivreal.io/${shape} & more/item/1`,
    );
  }
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(buildDetailUrl({}, 'shows', 'one'), undefined);
});
