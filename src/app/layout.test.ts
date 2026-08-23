import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isDemoSite, getDemoSourceUrl } from '../lib/seo/demoSafety.ts';
import { buildRouteCanonicalMetadata } from '../lib/seo/routeMetadata.ts';

// CONCERN 9 close-out (vivreal.io cutover security review): Templates now
// reads siteDetails.values.canonicalUrl and emits it as the root
// `<link rel="canonical">`. VR_Secure_API's cutover endpoint writes
// canonicalUrl BEFORE lifecycleState flips to 'live' (write-ahead so Stage 6
// can confirm the render pre-mutation) — so a demo site can genuinely carry a
// populated, production-pointing canonicalUrl while still `lifecycleState:
// 'demo'`. This suite proves that never leaks: a demo site must emit no
// canonical link pointing at that value AND must still emit noindex, exactly
// as it did before canonicalUrl existed.

test('generateMetadata gates the new canonical on the SAME demo flag that gates noindex', () => {
  const source = fs.readFileSync(new URL('./layout.tsx', import.meta.url), 'utf8');
  // Both branches must read from one `const demo = isDemoSite(siteData)` —
  // if they ever derived demo status independently, the two checks could
  // drift and a demo page could end up noindexed but still canonical-leaking
  // (or vice versa).
  assert.match(source, /const demo = isDemoSite\(siteData\)/);
  assert.match(source, /\.\.\.\(demo && \{ robots: \{ index: false, follow: false \} \}\)/);
  assert.match(source, /\.\.\.\(!demo && buildRouteCanonicalMetadata\(siteData, '\/'\)\)/);
});

test('demo site with a populated (stale, prod-pointing) canonicalUrl and no known source: noindex fires, no canonical link at all', () => {
  const siteData = {
    lifecycleState: 'demo' as const,
    canonicalUrl: 'https://vivreal.io',
    sourceUrl: undefined,
  };
  const demo = isDemoSite(siteData);
  const demoSource = demo ? getDemoSourceUrl(siteData) : '';
  // The exact spread shape generateMetadata builds, minus metadataBase/icons
  // (irrelevant to this assertion and not derived from demo/canonicalUrl).
  const metadata = {
    ...(demo && { robots: { index: false, follow: false } }),
    ...(demo && demoSource && { alternates: { canonical: demoSource } }),
    ...(!demo && buildRouteCanonicalMetadata(siteData, '/')),
  };
  assert.deepEqual(metadata.robots, { index: false, follow: false }, 'noindex still fires for the demo');
  assert.equal(metadata.alternates, undefined, 'no canonical link at all — the persisted canonicalUrl never leaks');
});

test('demo site with a populated canonicalUrl AND a known prospect source: canonical points at the source, never at canonicalUrl', () => {
  const siteData = {
    lifecycleState: 'demo' as const,
    canonicalUrl: 'https://vivreal.io',
    sourceUrl: 'https://prospect-original.example',
  };
  const demo = isDemoSite(siteData);
  const demoSource = demo ? getDemoSourceUrl(siteData) : '';
  const metadata = {
    ...(demo && { robots: { index: false, follow: false } }),
    ...(demo && demoSource && { alternates: { canonical: demoSource } }),
    ...(!demo && buildRouteCanonicalMetadata(siteData, '/')),
  };
  assert.deepEqual(metadata.robots, { index: false, follow: false }, 'noindex still fires for the demo');
  assert.deepEqual(metadata.alternates, { canonical: 'https://prospect-original.example' });
  assert.notEqual(
    metadata.alternates?.canonical,
    siteData.canonicalUrl,
    'the persisted (pre-cutover, possibly stale) canonicalUrl never becomes the emitted canonical',
  );
});

test('control: a live site with the SAME canonicalUrl DOES emit it, and emits no noindex', () => {
  const siteData = { lifecycleState: 'live' as const, canonicalUrl: 'https://vivreal.io', sourceUrl: undefined };
  const demo = isDemoSite(siteData);
  const demoSource = demo ? getDemoSourceUrl(siteData) : '';
  const metadata = {
    ...(demo && { robots: { index: false, follow: false } }),
    ...(demo && demoSource && { alternates: { canonical: demoSource } }),
    ...(!demo && buildRouteCanonicalMetadata(siteData, '/')),
  };
  assert.equal(metadata.robots, undefined, 'no noindex once live');
  assert.deepEqual(metadata.alternates, { canonical: 'https://vivreal.io' });
});
