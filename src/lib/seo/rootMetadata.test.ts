import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRootMetadata } from './rootMetadata.ts';
import type { SiteData } from '@/types/SiteData';

// buildRootMetadata is the REAL composition the root layout's
// generateMetadata() calls (layout.tsx just does `return
// buildRootMetadata(siteData)`) — extracted to a plain, JSX-free module so it
// can be invoked directly here instead of hand-replicated in a test file (the
// gap that let a demo-canonical leak through: canonical-emission-review.md
// CONCERN 5 / the layout.test.ts this file replaces).

test('demo site with a populated (stale, prod-pointing) canonicalUrl and no known source: noindex fires, no canonical link at all', () => {
  const siteData = {
    lifecycleState: 'demo',
    canonicalUrl: 'https://vivreal.io',
    sourceUrl: undefined,
  } as SiteData;
  const metadata = buildRootMetadata(siteData);
  assert.deepEqual(metadata.robots, { index: false, follow: false }, 'noindex still fires for the demo');
  assert.equal(metadata.alternates, undefined, 'no canonical link at all — the persisted canonicalUrl never leaks');
});

// W25-12a (owner decision 2026-10-10): a demo or prospect names NO canonical,
// including a source URL on another host. This used to expect the source as
// the canonical; that is the rule that let four demos name https://vivreal.io.
test('REFUSE (W25-12a): a demo with a known source URL on another host emits no canonical, and never canonicalUrl', () => {
  const siteData = {
    lifecycleState: 'demo',
    canonicalUrl: 'https://vivreal.io',
    sourceUrl: 'https://prospect-original.example',
  } as SiteData;
  const metadata = buildRootMetadata(siteData);
  assert.deepEqual(metadata.robots, { index: false, follow: false }, 'noindex still fires for the demo');
  assert.equal(metadata.alternates, undefined, 'no canonical: neither the source nor the persisted canonicalUrl');
});

test('REFUSE (W25-12a): Meridian shape, a demo whose source field holds our own home page, names no canonical', () => {
  const siteData = {
    lifecycleState: 'demo',
    sourceUrl: 'https://vivreal.io',
    domainInformation: { live_url: 'https://meridian-aesthetics.vivreal.io' },
  } as unknown as SiteData;
  const metadata = buildRootMetadata(siteData);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates, undefined);
});

test('REFUSE (W25-12a): a prospect is treated as a demo: noindex and no canonical', () => {
  const metadata = buildRootMetadata({ lifecycleState: 'prospect', sourceUrl: 'https://prospect-original.example' } as unknown as SiteData);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.equal(metadata.alternates, undefined);
});

test('control: an affirmatively live site emits no noindex and no root-level alternates (the home canonical is page.tsx\'s job, not the layout\'s)', () => {
  const siteData = { lifecycleState: 'live', canonicalUrl: 'https://vivreal.io', sourceUrl: undefined } as SiteData;
  const metadata = buildRootMetadata(siteData);
  assert.equal(metadata.robots, undefined, 'no noindex once live');
  assert.equal(metadata.alternates, undefined, 'root layout no longer emits a canonical — see CONCERN 1');
});

// ── BLOCK 1 (canonical-emission-review.md): the fail-safe-toward-demo gate ──
// A doc lifecycleState that is PRESENT but not the literal 'live' (an empty
// string, a typo, a case variant, a value some other write path left behind)
// must be treated as a demo — not silently fall through to "fully indexable
// with the persisted canonicalUrl emitted as-is," which is what happened
// before the demoSafety.ts fix.

for (const lifecycleState of ['', 'pending', 'Demo', 'DEMO', ' live']) {
  test(`ambiguous doc lifecycleState ${JSON.stringify(lifecycleState)} fails safe toward demo: noindex fires, no canonical`, () => {
    const siteData = {
      lifecycleState,
      canonicalUrl: 'https://prod-apex.example',
      sourceUrl: 'https://prospect-original.example',
    } as unknown as SiteData;
    const metadata = buildRootMetadata(siteData);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    // W25-12a: a demo names no canonical (this used to expect the source URL).
    assert.equal(metadata.alternates, undefined);
  });
}

test('doc lifecycleState absent, no SITE_LIFECYCLE env: NOT a demo (the existing-fleet fail-safe default)', () => {
  const envBefore = process.env.SITE_LIFECYCLE;
  delete process.env.SITE_LIFECYCLE;
  try {
    const siteData = { canonicalUrl: 'https://prod-apex.example', domainName: 'legacy.example' } as SiteData;
    const metadata = buildRootMetadata(siteData);
    assert.equal(metadata.robots, undefined, 'an existing site with no lifecycleState stays indexable');
  } finally {
    if (envBefore === undefined) delete process.env.SITE_LIFECYCLE;
    else process.env.SITE_LIFECYCLE = envBefore;
  }
});

test('favicon: present sets icons.icon, absent sets no icons key at all', () => {
  const withFavicon = buildRootMetadata({ favicon: 'https://cdn.example/favicon.png' } as SiteData);
  assert.deepEqual(withFavicon.icons, { icon: 'https://cdn.example/favicon.png' });
  const withoutFavicon = buildRootMetadata({} as SiteData);
  assert.equal(withoutFavicon.icons, undefined);
});

// V7.250: vivreal.io stored its favicon as a 221,164-character base64 PNG data
// URI and every HTML response inlined it (81% of each gzipped page). An inline
// icon over 32,768 characters is refused so Next's /icon and /apple-icon
// convention routes (src/app/icon.tsx, built from the hosted logo) serve
// instead, the same path every site without a stored favicon already takes.
const PNG_PREFIX = 'data:image/png;base64,';
const oversizedDataUri = PNG_PREFIX + 'A'.repeat(221_164);

test('REFUSE (V7.250): an oversized data: favicon is not inlined, no icons override at all', () => {
  const metadata = buildRootMetadata({ favicon: oversizedDataUri } as SiteData);
  assert.equal(metadata.icons, undefined);
});

test('REFUSE (V7.250): the size cap is not dodged by case or padding on the data: scheme', () => {
  for (const favicon of ['DATA:image/png;base64,' + 'A'.repeat(40_000), '  Data:image/png;base64,' + 'A'.repeat(40_000)]) {
    const metadata = buildRootMetadata({ favicon } as SiteData);
    assert.equal(metadata.icons, undefined, JSON.stringify(favicon.slice(0, 12)));
  }
});

test('REFUSE (V7.250): one character over the 32,768 cap is refused, exactly the cap is allowed', () => {
  const atCap = PNG_PREFIX + 'A'.repeat(32_768 - PNG_PREFIX.length);
  const overCap = atCap + 'A';
  assert.equal(atCap.length, 32_768);
  assert.deepEqual(buildRootMetadata({ favicon: atCap } as SiteData).icons, { icon: atCap });
  assert.equal(buildRootMetadata({ favicon: overCap } as SiteData).icons, undefined);
});

test('ALLOW (V7.250): a hosted favicon URL passes through unchanged, whatever its length', () => {
  const hosted = 'https://media.vivreal.io/groupObjects/abc/' + 'x'.repeat(40_000) + '/favicon.png';
  assert.deepEqual(buildRootMetadata({ favicon: hosted } as SiteData).icons, { icon: hosted });
});

// The Studio downscales an owner's upload to a 64x64 PNG before storing it.
// pod_01 holds one at 10,734 characters (2026-10-17); a 64x64 RGBA PNG tops
// out near 22,100. Refusing these would silently drop an owner's own icon.
test('ALLOW (V7.250): a Studio 64x64 PNG favicon passes, at the stored size and at the format worst case', () => {
  for (const length of [10_734, 22_200]) {
    const studio = PNG_PREFIX + 'A'.repeat(length - PNG_PREFIX.length);
    assert.deepEqual(buildRootMetadata({ favicon: studio } as SiteData).icons, { icon: studio }, String(length));
  }
});

test('ALLOW (V7.250): a tiny inline data: favicon passes through unchanged', () => {
  const tiny = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ctext y='24'%3EV%3C/text%3E%3C/svg%3E";
  assert.deepEqual(buildRootMetadata({ favicon: tiny } as SiteData).icons, { icon: tiny });
});

test('a whitespace-only favicon is treated as absent, not emitted as an href', () => {
  assert.equal(buildRootMetadata({ favicon: '   ' } as SiteData).icons, undefined);
});
