import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SiteData } from '@/types/SiteData';
import { buildRootMetadata } from './rootMetadata.ts';
import { homeMetaText, pageMetaText, readBusinessFacts } from './pageMetaText.ts';

// Discovery batch 3.7 (verification), 3.10 items 11, 14, 16 (domains share
// card and date, show card, summaries). Every ALLOW has its REFUSE.

// Lazily imported: on a tree without these the file still loads and the
// assertions, not an import error, are what fail.
const publicSearch = (await import('../domains/publicSearch.ts')) as Record<string, unknown>;

const CODE = 'abcDEF123_-xyzXYZ7890aa';
const live = (extra: Record<string, unknown> = {}) =>
  ({ lifecycleState: 'live', domainInformation: { live_url: 'https://cobaltcrumb.com' }, ...extra }) as SiteData;

// ---------------------------------------------------------------------------
// 3.7 Search Console verification
// ---------------------------------------------------------------------------

test('ALLOW: a stored verification code becomes the google-site-verification meta on every page', () => {
  assert.deepEqual(buildRootMetadata(live({ googleSiteVerification: CODE })).verification, { google: CODE });
});

test('REFUSE (absent SE1 field, byte for byte): no code means no verification key at all', () => {
  const withNone = buildRootMetadata(live());
  assert.equal('verification' in withNone, false);
  assert.deepEqual(buildRootMetadata(live({ googleSiteVerification: null })), withNone);
  assert.deepEqual(buildRootMetadata(live({ googleSiteVerification: '' })), withNone);
});

test('REFUSE: a malformed code is never put in the page (address-record form, markup, spaces, too short)', () => {
  for (const bad of [`google-site-verification=${CODE}`, `<meta content="${CODE}">`, 'abc def ghi jkl mno pqr', 'short12345']) {
    assert.equal(buildRootMetadata(live({ googleSiteVerification: bad })).verification, undefined, bad);
  }
});

// ---------------------------------------------------------------------------
// 3.10 item 16: summaries
// ---------------------------------------------------------------------------

const BUSINESS = { contactInfo: {}, name: 'Cobalt & Crumb', address: { city: 'Knoxville', state: 'TN' } };

test('ALLOW: the privacy and terms pages get NO generated summary (they rely on the title)', () => {
  const facts = readBusinessFacts(BUSINESS, undefined);
  for (const slug of ['privacy', 'terms', 'privacy-policy', 'terms-of-service']) {
    const { title, description } = pageMetaText({ page: { name: 'Privacy', format: 'static', labels: {} }, slug, facts });
    assert.equal(description, undefined, slug);
    assert.equal(title, 'Privacy | Cobalt & Crumb');
  }
});

test('REFUSE: the owner’s own summary on a utility page still wins, and other pages keep their summary', () => {
  const facts = readBusinessFacts(BUSINESS, undefined);
  assert.equal(
    pageMetaText({ page: { name: 'Privacy', format: 'static', labels: {}, seo: { metaDescription: 'How we use your details.' } }, slug: 'privacy', facts }).description,
    'How we use your details.',
  );
  assert.equal(
    pageMetaText({ page: { name: 'Menu', format: 'menu', labels: {} }, slug: 'menu', facts }).description,
    'Menu at Cobalt & Crumb in Knoxville, TN.',
  );
});

test('ALLOW: with a business type set, summaries say what the business is ("a bakery in Knoxville, TN")', () => {
  const facts = readBusinessFacts({ ...BUSINESS, businessType: 'bakery' }, undefined);
  assert.equal(pageMetaText({ page: { name: 'Menu', format: 'menu', labels: {} }, slug: 'menu', facts }).description, 'Menu at Cobalt & Crumb, a bakery in Knoxville, TN.');
  assert.equal(homeMetaText({ seo: undefined, facts }).description, 'Cobalt & Crumb, a bakery in Knoxville, TN.');
});

test('REFUSE (absent SE1 field, byte for byte): no business type keeps every summary exactly as before', () => {
  const facts = readBusinessFacts(BUSINESS, undefined);
  assert.equal(homeMetaText({ seo: undefined, facts }).description, 'Cobalt & Crumb, in Knoxville, TN.');
  const withDesc = readBusinessFacts({ ...BUSINESS, description: 'Small batch bread.' }, undefined);
  assert.equal(homeMetaText({ seo: undefined, facts: withDesc }).description, 'Cobalt & Crumb, in Knoxville, TN. Small batch bread.');
  assert.equal(pageMetaText({ page: { name: 'Menu', format: 'menu', labels: {} }, slug: 'menu', facts: withDesc }).description, 'Menu at Cobalt & Crumb in Knoxville, TN. Small batch bread.');
  const nowhere = readBusinessFacts({ contactInfo: {}, name: 'Cobalt & Crumb' }, undefined);
  assert.equal(homeMetaText({ seo: undefined, facts: nowhere }).description, 'Welcome to Cobalt & Crumb. Discover our latest content, events, and more.');
  assert.equal('kind' in facts, false);
});

// ---------------------------------------------------------------------------
// 3.10 item 11 and 3.3: /domains share card and date
// ---------------------------------------------------------------------------

test('ALLOW: /domains has Open Graph and Twitter tags with the /og/domains card', () => {
  assert.equal(typeof publicSearch.domainsShareMetadata, 'function', 'domainsShareMetadata exists');
  const share = (publicSearch.domainsShareMetadata as (o: string, n: string) => Record<string, Record<string, unknown>>)('https://vivreal.io', 'Vivreal');
  assert.deepEqual(share.openGraph.images, ['https://vivreal.io/og/domains']);
  assert.equal(share.openGraph.url, 'https://vivreal.io/domains');
  assert.equal(share.openGraph.siteName, 'Vivreal');
  assert.equal(share.twitter.card, 'summary_large_image');
  const page = readFileSync(new URL('../../app/domains/page.tsx', import.meta.url), 'utf8');
  assert.ok(page.includes('...domainsShareMetadata('), 'the page spreads it into its metadata');
});

test('ALLOW: /domains lists its own date in the sitemap; REFUSE: never the clock', () => {
  const date = publicSearch.DOMAINS_PAGE_UPDATED;
  assert.equal(typeof date, 'string', 'DOMAINS_PAGE_UPDATED exists');
  assert.equal(new Date(date as string).toISOString(), date, 'a fixed ISO date');
  const loader = readFileSync(new URL('./loadSitemapEntries.ts', import.meta.url), 'utf8');
  assert.ok(loader.includes('lastModified: DOMAINS_PAGE_UPDATED'));
  assert.ok(!/lastModified: new Date\(/.test(loader), 'never stamped with the clock');
});

// ---------------------------------------------------------------------------
// 3.10 item 14 and 3.6: the show route
// ---------------------------------------------------------------------------

const detailRoute = readFileSync(new URL('../../app/[slug]/[itemId]/page.tsx', import.meta.url), 'utf8');

test('ALLOW: a show page’s share card is the show’s own (/og/<slug>/<itemId>); REFUSE: not the section card', () => {
  const start = detailRoute.indexOf('if (pageConfig.format === "shows") {', detailRoute.indexOf('export async function generateMetadata'));
  assert.ok(start > 0, 'sanity: the show metadata arm was found');
  const arm = detailRoute.slice(start, detailRoute.indexOf('if (pageConfig.format === "team")', start));
  // T4 builds it from the show's id once the address is readable (discovery 3.10 item 13).
  assert.ok(arm.includes('buildOgItemImageUrl(origin, slug, itemId)') || arm.includes('buildOgItemImageUrl(origin, slug, show.id)'));
  assert.ok(!arm.includes('images: [ogImageUrl]'), 'the section card is gone from the show arm');
});

test('ALLOW: a hidden street address is never an event’s place either', () => {
  assert.ok(detailRoute.includes('siteData.businessInfo?.hideStreetAddress === true ? undefined : siteData.businessInfo?.address'));
});
