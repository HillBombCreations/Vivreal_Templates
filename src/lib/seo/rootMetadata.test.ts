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

test('demo site with a populated canonicalUrl AND a known prospect source: canonical points at the source, never at canonicalUrl', () => {
  const siteData = {
    lifecycleState: 'demo',
    canonicalUrl: 'https://vivreal.io',
    sourceUrl: 'https://prospect-original.example',
  } as SiteData;
  const metadata = buildRootMetadata(siteData);
  assert.deepEqual(metadata.robots, { index: false, follow: false }, 'noindex still fires for the demo');
  assert.deepEqual(metadata.alternates, { canonical: 'https://prospect-original.example' });
  assert.notEqual(
    metadata.alternates?.canonical,
    siteData.canonicalUrl,
    'the persisted (pre-cutover, possibly stale) canonicalUrl never becomes the emitted canonical',
  );
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
  test(`ambiguous doc lifecycleState ${JSON.stringify(lifecycleState)} fails safe toward demo: noindex fires, source canonical wins`, () => {
    const siteData = {
      lifecycleState,
      canonicalUrl: 'https://prod-apex.example',
      sourceUrl: 'https://prospect-original.example',
    } as unknown as SiteData;
    const metadata = buildRootMetadata(siteData);
    assert.deepEqual(metadata.robots, { index: false, follow: false });
    assert.deepEqual(metadata.alternates, { canonical: 'https://prospect-original.example' });
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
