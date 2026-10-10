import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
import { buildSiteJsonLd, openingHoursSpecification } from './schema.ts';
// The renderer's own hours parser, by file path: its package entry point loads
// React components the plain-Node runner cannot, and this module is pure.
import { readSiteHours } from '../../../node_modules/@hillbombcreations/site-renderer/dist/lib/siteHours.js';

// Cast: a fixture carries only the fields these builders read.
const site = (businessInfo: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  ({
    lifecycleState: 'live',
    canonicalUrl: 'https://cobaltcrumb.com',
    businessInfo: { name: 'Cobalt & Crumb', contactInfo: { email: 'hi@cobaltcrumb.com', phoneNumber: '865-555-0100' }, ...businessInfo },
    pageConfigs: [],
    ...extra,
  }) as unknown as SiteData;

const HOURS = {
  weekly: ['Mon - Fri: 9am - 5pm', 'Sat: 10am - 2pm', 'Sun: Closed', 'Tues: 12p-Close'],
  changes: [
    { from: '2026-12-25', to: '2026-12-25', times: 'Closed', label: 'Christmas Day' },
    { from: '2026-10-01', to: '2026-10-02', times: '9am to 1pm', label: 'Fair' },
  ],
};
const TODAY = '2026-10-10';
const org = (siteData: SiteData, hours = readSiteHours(siteData.businessInfo?.hours)) =>
  buildSiteJsonLd(siteData, { hours, today: TODAY })[0];

test('ALLOW (F-C15): weekly hours become openingHoursSpecification from the renderer parse', () => {
  const spec = openingHoursSpecification(readSiteHours(HOURS), TODAY);
  assert.deepEqual(spec[0], {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '17:00',
  });
  assert.deepEqual(spec[2], { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Sunday'], opens: '00:00', closes: '00:00' });
});

test('REFUSE (F-C15): a row whose times nobody could read is never claimed', () => {
  const spec = openingHoursSpecification(readSiteHours(HOURS), TODAY);
  assert.equal(spec.filter((s) => Array.isArray(s.dayOfWeek) && (s.dayOfWeek as string[]).length === 1 && (s.dayOfWeek as string[])[0] === 'Tuesday').length, 0);
});

test('ALLOW (F-C15): a special closed day appears only that date', () => {
  const spec = openingHoursSpecification(readSiteHours(HOURS), TODAY);
  const xmas = spec.filter((s) => s.validFrom);
  assert.deepEqual(xmas, [
    { '@type': 'OpeningHoursSpecification', validFrom: '2026-12-25', validThrough: '2026-12-25', opens: '00:00', closes: '00:00' },
  ]);
});

test('REFUSE (F-C15): a change that ended before today is left out', () => {
  const spec = openingHoursSpecification(readSiteHours(HOURS), TODAY);
  assert.equal(spec.some((s) => s.validFrom === '2026-10-01'), false);
});

test('ALLOW (R4): LocalBusiness carries hours, the towns served, the phone, and the Google listing in sameAs', () => {
  const ld = org(site({ hours: HOURS, serviceArea: ['Knoxville', ' Maryville '], googleBusinessUrl: 'https://maps.app.goo.gl/abc' }, {
    socialLinks: [{ type: 'instagram', link: 'https://instagram.com/cobalt' }],
  }));
  assert.equal(ld['@type'], 'LocalBusiness');
  assert.deepEqual(ld.areaServed, ['Knoxville', 'Maryville']);
  assert.equal(ld.telephone, '865-555-0100');
  assert.deepEqual(ld.sameAs, ['https://instagram.com/cobalt', 'https://maps.app.goo.gl/abc']);
  assert.ok(Array.isArray(ld.openingHoursSpecification));
});

test('REFUSE (R4): a non-https Google link is not claimed in sameAs', () => {
  const ld = org(site({ googleBusinessUrl: 'javascript:alert(1)' }));
  assert.equal(ld.sameAs, undefined);
});

test('ALLOW (OD-9): the email shows when showEmail is true or absent', () => {
  assert.equal(org(site({ showEmail: true })).email, 'hi@cobaltcrumb.com');
  assert.equal(org(site({})).email, 'hi@cobaltcrumb.com');
});

test('REFUSE (OD-9): the email is left out when the owner hides it', () => {
  assert.equal(org(site({ showEmail: false })).email, undefined);
});

test('REFUSE (F-C15): a site with no businessInfo.hours emits exactly today\'s description', () => {
  const legacy = site({ address: { city: 'Knoxville' } });
  assert.deepEqual(buildSiteJsonLd(legacy, { hours: readSiteHours(undefined), today: TODAY }), buildSiteJsonLd(legacy));
  assert.equal(org(legacy).openingHoursSpecification, undefined);
  assert.equal(org(site({}))['@type'], 'Organization', 'no address and no hours is still an Organization');
});

test('ALLOW (R4): an Article carries dateModified from the item', async () => {
  const { buildDetailJsonLd } = await import('./schema.ts');
  const ld = buildDetailJsonLd({ format: 'article', title: 'Post', dateModified: '2026-10-01T12:00:00.000Z' });
  assert.equal(ld['@type'], 'Article');
  assert.equal(ld.dateModified, '2026-10-01T12:00:00.000Z');
});

test('REFUSE (R4): no item date, no dateModified (never the clock)', async () => {
  const { buildDetailJsonLd } = await import('./schema.ts');
  assert.equal(buildDetailJsonLd({ format: 'article', title: 'Post' }).dateModified, undefined);
});
