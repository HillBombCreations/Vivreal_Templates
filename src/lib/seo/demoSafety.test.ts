import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { SiteData } from '@/types/SiteData';
// Explicit .ts extension: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which needs a resolvable specifier.
import { isDemoSite, getDemoSourceUrl } from './demoSafety.ts';
// The three (now four) demo gates, each in a plain JSX-free module so this
// file can call the REAL function rather than assert on its source text.
import { buildRobotsPolicy } from './robotsPolicy.ts';
import { buildSiteMapForSite } from './siteMapPolicy.ts';
import { buildRootMetadata } from './rootMetadata.ts';
import { buildSiteJsonLd } from '../../components/JsonLd/schema.ts';
import { buildDetailUrl } from '../og/siteOrigin.ts';
import { FALLBACK_SITE_DATA } from '../api/siteData/fallback.ts';

// demoSafety is the SEO demo-safety gate: a pre-cutover demo must be withheld
// from search indexes, and — critically — the DEFAULT must be indexable so no
// existing live customer site is ever accidentally deindexed.

const ENV_LIFECYCLE = process.env.SITE_LIFECYCLE;
const ENV_SOURCE = process.env.SITE_SOURCE_URL;
const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  // Restore env after each case (tests mutate process.env to exercise fallbacks).
  if (ENV_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ENV_LIFECYCLE;
  if (ENV_SOURCE === undefined) delete process.env.SITE_SOURCE_URL;
  else process.env.SITE_SOURCE_URL = ENV_SOURCE;
  if (ENV_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ENV_SITE_URL;
});

test('FAIL-SAFE DEFAULT: no flag and no env ⇒ NOT a demo (indexable)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite(undefined), false);
  assert.equal(isDemoSite(null), false);
  assert.equal(isDemoSite({}), false, 'an existing site with no lifecycleState stays indexable');
  assert.equal(isDemoSite({ lifecycleState: undefined }), false);
});

test('an explicit lifecycleState=demo ⇒ demo (withheld from indexing)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite({ lifecycleState: 'demo' }), true);
});

test('lifecycleState EXPLICITLY null (key present, value null) ⇒ demo — distinct from a truly absent key', () => {
  // canonical-emission-review.md Pass 2 CONCERN B: VR_Secure_API's
  // PRESERVE_ON_REPLACE merge only restores a preserved key when the
  // incoming value is `undefined`; an explicit `null` wins as a deliberate
  // clear and can land in the stored doc distinct from the key never having
  // been written. Fail safe toward demo, same as any other present-but-not-
  // 'live' value — do NOT treat this the same as the truly-absent-key case
  // (isDemoSite(undefined) / isDemoSite({})) above.
  delete process.env.SITE_LIFECYCLE;
  // `as unknown as` — deliberately outside lifecycleState's declared
  // `'demo'|'live'` union: the exact runtime shape a loose Mixed Mongo field
  // can actually carry (same convention as rootMetadata.test.ts's ambiguous-
  // value cases).
  assert.equal(isDemoSite({ lifecycleState: null } as unknown as Pick<SiteData, 'lifecycleState'>), true);
});

test('lifecycleState=live ⇒ NOT a demo (indexable)', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.equal(isDemoSite({ lifecycleState: 'live' }), false);
});

test('SITE_LIFECYCLE env is a fallback when the doc has no flag', () => {
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(isDemoSite(undefined), true, 'env protects a demo before the doc flag is written');
  assert.equal(isDemoSite({}), true);
});

test('the doc flag takes precedence over the env fallback', () => {
  process.env.SITE_LIFECYCLE = 'demo';
  assert.equal(isDemoSite({ lifecycleState: 'live' }), false, 'cutover (doc=live) wins over a stale env=demo');
});

test('a non-"demo" env value does not trigger the gate', () => {
  process.env.SITE_LIFECYCLE = 'live';
  assert.equal(isDemoSite(undefined), false);
  process.env.SITE_LIFECYCLE = 'production';
  assert.equal(isDemoSite(undefined), false);
});

test('getDemoSourceUrl: prefers the doc sourceUrl, falls back to env, else ""', () => {
  delete process.env.SITE_SOURCE_URL;
  assert.equal(getDemoSourceUrl({ sourceUrl: 'https://prospect.example' }), 'https://prospect.example');
  assert.equal(getDemoSourceUrl(undefined), '', 'unknown source ⇒ empty (caller skips canonical)');
  process.env.SITE_SOURCE_URL = 'https://env-source.example';
  assert.equal(getDemoSourceUrl(undefined), 'https://env-source.example', 'env fallback used when doc lacks it');
  assert.equal(getDemoSourceUrl({ sourceUrl: 'https://doc.example' }), 'https://doc.example', 'doc wins over env');
});

// ═══════════════════════════════════════════════════════════════════════════
// design.md item 28: "extend src/lib/seo/demoSafety.test.ts ... Pin apex,
// env/live-url/domain-name fallback, and demo behavior for site-level and every
// detail JSON-LD shape, plus robots/sitemap/feed consistency."
//
// This block exists because mutation testing (review-templates-106.md B2)
// proved all THREE gates that make a demo site safe could be deleted
// individually with the whole suite still green:
//
//   - the robots demo gate        (was src/app/robots.tsx:30)
//   - the sitemap demo gate       (was src/lib/api/siteData/index.tsx:355)
//   - the layout noindex          (was src/app/layout.tsx:58)
//
// A gate with no behavioural test is a gate that will be refactored away by
// someone who has never heard of it. Each gate now lives in a plain, JSX-free
// module (robotsPolicy.ts / siteMapPolicy.ts / rootMetadata.ts) so these
// assertions call the REAL function rather than asserting on its source text.
// ═══════════════════════════════════════════════════════════════════════════

const DEMO_SITE = {
  lifecycleState: 'demo' as const,
  // A demo carrying every origin field that exists, including a write-ahead
  // canonicalUrl the cutover endpoint can persist BEFORE the lifecycle flip.
  // None of them may reach a crawler while the site is a demo.
  canonicalUrl: 'https://vivreal.io',
  domainName: 'prospect-original.example',
  domainInformation: { live_url: 'https://demo-sub.vivreal.io' },
  sourceUrl: 'https://prospect-original.example',
} as SiteData;

const LIVE_SITE = {
  lifecycleState: 'live' as const,
  domainInformation: { live_url: 'https://classichousephx.vivreal.io' },
} as SiteData;

const PAGES = [
  { slug: 'home', format: 'home' },
  { slug: 'about', format: 'about' },
];

test('GATE 1 (robots): a demo emits Disallow: / and NO Sitemap: directive', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const policy = buildRobotsPolicy(DEMO_SITE);
  assert.deepEqual(policy.rules, [{ userAgent: '*', disallow: '/' }], 'exactly one blanket disallow rule');
  assert.equal(policy.sitemap, undefined, 'a demo must never advertise a sitemap');
  // The control: without the gate this is what a demo would serve, so if the
  // gate is deleted the assertion above sees THIS shape and fails.
  const livePolicy = buildRobotsPolicy(LIVE_SITE);
  assert.ok(Array.isArray(livePolicy.rules) && livePolicy.rules.length > 1, 'a live site gets the full policy');
  assert.equal(livePolicy.sitemap, 'https://classichousephx.vivreal.io/sitemap.xml');
});

test('GATE 1 (robots): the fail-safe-toward-demo lifecycle values are gated too', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  for (const lifecycleState of ['', 'pending', 'Demo', 'DEMO', ' live', null]) {
    const policy = buildRobotsPolicy({ ...DEMO_SITE, lifecycleState } as unknown as SiteData);
    assert.deepEqual(policy.rules, [{ userAgent: '*', disallow: '/' }], JSON.stringify(lifecycleState));
    assert.equal(policy.sitemap, undefined, JSON.stringify(lifecycleState));
  }
});

test('GATE 2 (sitemap): a demo emits an EMPTY sitemap even with pages and every origin field populated', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.deepEqual(buildSiteMapForSite(DEMO_SITE, PAGES), []);
  assert.deepEqual(
    buildSiteMapForSite(DEMO_SITE, PAGES, { about: ['item-1'] }),
    [],
    'not even opted-in detail items leak',
  );
  // The control: without the gate a demo would emit these.
  const liveEntries = buildSiteMapForSite(LIVE_SITE, PAGES);
  assert.deepEqual(
    liveEntries.map((e) => e.url),
    ['https://classichousephx.vivreal.io', 'https://classichousephx.vivreal.io/about'],
    'a live site gets the full sitemap',
  );
});

test('GATE 3 (layout): a demo emits noindex,nofollow and the ORIGINAL source canonical, never its own origin', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const metadata = buildRootMetadata(DEMO_SITE);
  assert.deepEqual(metadata.robots, { index: false, follow: false });
  assert.deepEqual(metadata.alternates, { canonical: 'https://prospect-original.example' });
  assert.notEqual(metadata.alternates?.canonical, DEMO_SITE.canonicalUrl, 'the write-ahead canonicalUrl never leaks');
  // The control: a live site adds neither key, so a deleted gate is visible.
  const liveMetadata = buildRootMetadata(LIVE_SITE);
  assert.equal(liveMetadata.robots, undefined);
  assert.equal(liveMetadata.alternates, undefined);
});

test('GATE 4 (JSON-LD): a demo emits no site-level `url`, so it never claims ownership of content', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  const [organization, website] = buildSiteJsonLd(DEMO_SITE);
  assert.equal(organization.url, undefined);
  assert.equal(website.url, undefined);
  const [liveOrganization, liveWebsite] = buildSiteJsonLd(LIVE_SITE);
  assert.equal(liveOrganization.url, 'https://classichousephx.vivreal.io');
  assert.equal(liveWebsite.url, 'https://classichousephx.vivreal.io');
});

test('GATE 4 (JSON-LD): a demo detail URL never resolves onto the write-ahead apex', () => {
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(
    buildDetailUrl(DEMO_SITE, 'shows', 'abc123'),
    'https://demo-sub.vivreal.io/shows/abc123',
    'resolves the demo\'s own origin, never the persisted canonicalUrl',
  );
});

test('ALL GATES: an upstream outage fails CLOSED, because FALLBACK_SITE_DATA is an explicit demo', () => {
  // getSiteData() returns FALLBACK_SITE_DATA whenever VR_Client_API gives us
  // nothing, and robots.tsx is force-dynamic so it re-evaluates every request.
  // With no lifecycleState the key is absent, isDemoSite() takes its
  // existing-fleet "not a demo" default, and a sustained outage silently
  // un-gates every demo site in the fleet (review-templates-106.md,
  // "The demo gate is fail-open on an upstream outage").
  delete process.env.SITE_LIFECYCLE;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(FALLBACK_SITE_DATA.lifecycleState, 'demo', 'the fallback must declare itself a demo');
  assert.equal(isDemoSite(FALLBACK_SITE_DATA), true);
  assert.deepEqual(buildRobotsPolicy(FALLBACK_SITE_DATA).rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(buildRobotsPolicy(FALLBACK_SITE_DATA).sitemap, undefined);
  assert.deepEqual(buildSiteMapForSite(FALLBACK_SITE_DATA, PAGES), []);
  assert.deepEqual(buildRootMetadata(FALLBACK_SITE_DATA).robots, { index: false, follow: false });
});
