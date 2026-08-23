import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteCanonicalMetadata, resolveRouteCanonical } from './routeMetadata.ts';

const live = { lifecycleState: 'live' as const, canonicalUrl: 'https://vivreal.io' };
const demo = { lifecycleState: 'demo' as const, canonicalUrl: 'https://vivreal.io' };

test('live home, slug, and detail metadata emit route-correct apex canonicals', () => {
  assert.deepEqual(buildRouteCanonicalMetadata(live, '/'), { alternates: { canonical: 'https://vivreal.io' } });
  assert.equal(resolveRouteCanonical(live, '/about'), 'https://vivreal.io/about');
  assert.equal(resolveRouteCanonical(live, '/shows/item-1'), 'https://vivreal.io/shows/item-1');
});

test('default-absent proof: a live site with domainName/live_url but NO canonicalUrl emits nothing new on home, a slug page, or a detail item', () => {
  // Every real fleet site already has domainName + domainInformation.live_url
  // populated. Before canonicalUrl existed, none of these routes ever emitted
  // a <link rel="canonical">. This is the byte-identical guarantee.
  const noCanonicalUrl = {
    lifecycleState: 'live' as const,
    domainName: 'realcustomer.example',
    domainInformation: { live_url: 'https://realcustomer.example' },
  };
  assert.deepEqual(buildRouteCanonicalMetadata(noCanonicalUrl, '/'), {});
  assert.equal(resolveRouteCanonical(noCanonicalUrl, '/about'), undefined);
  assert.equal(resolveRouteCanonical(noCanonicalUrl, '/shows/item-1'), undefined);
});

test('demo route metadata emits no child canonical so the root source canonical remains authoritative', () => {
  assert.deepEqual(buildRouteCanonicalMetadata(demo, '/'), {});
  assert.equal(resolveRouteCanonical(demo, '/about'), undefined);
  assert.equal(resolveRouteCanonical(demo, '/shows/item-1', 'https://vivreal.io/other'), undefined);
});

test('default-absent: an unset canonicalUrl emits NO route canonical, even when env/live_url/domainName resolve — the fleet-wide byte-identical requirement', () => {
  // Corrected expectation (was: fell back to NEXT_PUBLIC_SITE_URL). Every
  // existing fleet site already has an env origin or a domainName, so that
  // fallback would have synthesized a brand-new canonical tag on every page
  // of every site that never emitted one before canonicalUrl existed. The
  // route canonical must resolve from canonicalUrl alone (or an explicit
  // override) — never from the general origin chain. See resolveCanonicalUrl.
  const envBefore = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example';
  try {
    assert.equal(resolveRouteCanonical({ lifecycleState: 'live', canonicalUrl: undefined }, '/about'), undefined);
    assert.equal(resolveRouteCanonical(live, '/items/one', 'https://vivreal.io/canonical-item'), 'https://vivreal.io/canonical-item');
  } finally {
    if (envBefore === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = envBefore;
  }
});
