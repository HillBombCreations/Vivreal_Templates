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

test('ALLOW (v5 R4): a live site with no canonicalUrl names its resolved address on home, a slug page and a detail item', () => {
  const noCanonicalUrl = {
    lifecycleState: 'live' as const,
    domainName: 'realcustomer.example',
    domainInformation: { live_url: 'https://realcustomer.example' },
  };
  assert.deepEqual(buildRouteCanonicalMetadata(noCanonicalUrl, '/'), { alternates: { canonical: 'https://realcustomer.example' } });
  assert.equal(resolveRouteCanonical(noCanonicalUrl, '/about'), 'https://realcustomer.example/about');
  assert.equal(resolveRouteCanonical(noCanonicalUrl, '/shows/item-1'), 'https://realcustomer.example/shows/item-1');
});

test('REFUSE (v5 R4): an amplifyapp build host is never a canonical, and with nothing durable there is no tag', () => {
  const amplifyOnly = { lifecycleState: 'live' as const, domainInformation: { live_url: 'https://main.d1abc.amplifyapp.com' } };
  assert.equal(resolveRouteCanonical(amplifyOnly, '/about'), undefined);
  assert.equal(resolveRouteCanonical({ lifecycleState: 'live' as const }, '/about'), undefined);
});

test('demo route metadata emits no child canonical so the root source canonical remains authoritative', () => {
  assert.deepEqual(buildRouteCanonicalMetadata(demo, '/'), {});
  assert.equal(resolveRouteCanonical(demo, '/about'), undefined);
  assert.equal(resolveRouteCanonical(demo, '/shows/item-1', 'https://vivreal.io/other'), undefined);
});

test('the stored canonicalUrl and an explicit override still win over the resolved address', () => {
  const both = { lifecycleState: 'live' as const, canonicalUrl: 'https://vivreal.io', domainInformation: { live_url: 'https://other.example' } };
  assert.equal(resolveRouteCanonical(both, '/about'), 'https://vivreal.io/about');
  assert.equal(resolveRouteCanonical(live, '/items/one', 'https://vivreal.io/canonical-item'), 'https://vivreal.io/canonical-item');
});
