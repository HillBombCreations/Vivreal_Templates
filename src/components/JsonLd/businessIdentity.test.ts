import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
import { buildSiteJsonLd } from './schema.ts';

// Discovery batch 3.6 (design section 6, rows "Business type" and "Hide
// address"). Every ALLOW has its REFUSE. Only `buildSiteJsonLd` is called, the
// function the root layout calls.

const ADDRESS = { street1: '123 Rye St', street2: 'Unit 2', city: 'Knoxville', state: 'TN', zip: '37902' };

function site(businessInfo: Record<string, unknown>, extra: Record<string, unknown> = {}): SiteData {
  return {
    lifecycleState: 'live',
    name: 'Waves of Grain Co.',
    domainInformation: { live_url: 'https://wavesofgrainco.com' },
    businessInfo: { contactInfo: {}, name: 'Waves of Grain Co.', ...businessInfo },
    ...extra,
  } as SiteData;
}

const org = (siteData: SiteData) => buildSiteJsonLd(siteData, { today: '2026-10-23' })[0];

test('ALLOW: businessType bakery gives a Bakery node, with its address', () => {
  const node = org(site({ businessType: 'bakery', address: ADDRESS }));
  assert.equal(node['@type'], 'Bakery');
  assert.deepEqual(node.address, {
    '@type': 'PostalAddress',
    streetAddress: '123 Rye St Unit 2',
    addressLocality: 'Knoxville',
    addressRegion: 'TN',
    postalCode: '37902',
  });
});

test('ALLOW: software-company with an address gives Organization (address kept) plus a SoftwareApplication, with no offers', () => {
  const nodes = buildSiteJsonLd(
    site({ businessType: 'software-company', address: ADDRESS, name: 'Vivreal' }, { domainInformation: { live_url: 'https://vivreal.io' } }),
    { today: '2026-10-23' },
  );
  assert.equal(nodes[0]['@type'], 'Organization');
  assert.ok(nodes[0].address, 'the registered address stays');
  const app = nodes.find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(app, 'a SoftwareApplication node is emitted');
  assert.equal(app.name, 'Vivreal');
  assert.equal(app.applicationCategory, 'BusinessApplication');
  assert.equal(app.operatingSystem, 'Web, iOS, Android');
  assert.deepEqual(app.publisher, { '@id': 'https://vivreal.io/#organization' });
  assert.equal(app.offers, undefined, 'no price is claimed here (honesty floor)');
});

test('ALLOW: an online-business with a street address stays an Organization, and claims no hours', () => {
  const node = org(site({ businessType: 'online-business', address: ADDRESS }));
  assert.equal(node['@type'], 'Organization');
  assert.equal(node.openingHoursSpecification, undefined);
});

test('REFUSE (absent SE1 field, byte for byte): no businessType keeps the output exactly as before', () => {
  // The heuristic, unchanged: an address makes a LocalBusiness, nothing makes an
  // Organization. Pinned as literals so any drift in the unset path is red.
  assert.deepEqual(org(site({ address: ADDRESS })), {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://wavesofgrainco.com/#organization',
    name: 'Waves of Grain Co.',
    url: 'https://wavesofgrainco.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '123 Rye St Unit 2',
      addressLocality: 'Knoxville',
      addressRegion: 'TN',
      postalCode: '37902',
    },
  });
  assert.equal(org(site({}))['@type'], 'Organization');
  assert.equal(buildSiteJsonLd(site({ address: ADDRESS })).length, 2, 'no extra node');
});

test('REFUSE: an empty or unknown businessType (not on the allowlist) is treated as unset', () => {
  const unset = org(site({ address: ADDRESS }));
  for (const businessType of ['', 'spaceship', 'Bakery', 'constructor', '__proto__']) {
    assert.deepEqual(org(site({ businessType, address: ADDRESS })), unset, JSON.stringify(businessType));
  }
});

test('ALLOW: hideStreetAddress drops the street and postcode, keeps the town, region and areaServed', () => {
  const node = org(site({ hideStreetAddress: true, address: ADDRESS, serviceArea: ['Knoxville', 'Maryville'] }));
  assert.deepEqual(node.address, { '@type': 'PostalAddress', addressLocality: 'Knoxville', addressRegion: 'TN' });
  assert.deepEqual(node.areaServed, ['Knoxville', 'Maryville']);
  assert.equal(node['@type'], 'LocalBusiness', 'still local: the business has an address, it just is not published');
  assert.ok(!JSON.stringify(node).includes('Rye St'), 'the street appears nowhere');
});

test('REFUSE: hideStreetAddress false or absent keeps the full address', () => {
  const full = org(site({ address: ADDRESS })).address;
  assert.deepEqual(org(site({ hideStreetAddress: false, address: ADDRESS })).address, full);
  assert.equal((full as Record<string, unknown>).streetAddress, '123 Rye St Unit 2');
});

test('the map holds exactly VR_Secure_API’s allowlist (src/shared/businessTypes.js, PR #366), key for key', async () => {
  const mod = (await import('../../lib/seo/businessTypeSchema.ts').catch(() => null)) as { BUSINESS_TYPE_SCHEMA?: Record<string, unknown> } | null;
  assert.ok(mod?.BUSINESS_TYPE_SCHEMA, 'the business type map exists');
  // Copied from origin/feat/discovery-batch-se1:src/shared/businessTypes.js.
  const SECURE_ALLOWLIST = [
    'bakery', 'brewery', 'bar', 'cafe', 'restaurant', 'winery', 'hair-salon', 'barber', 'beauty-salon',
    'nail-salon', 'day-spa', 'med-spa', 'florist', 'gym', 'clothing', 'store', 'event-venue', 'lodging',
    'professional-service', 'legal', 'performing-group', 'other-local', 'online-business', 'software-company',
  ];
  assert.deepEqual(Object.keys(mod.BUSINESS_TYPE_SCHEMA).sort(), [...SECURE_ALLOWLIST].sort());
});
