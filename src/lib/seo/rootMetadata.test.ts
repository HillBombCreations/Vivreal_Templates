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
