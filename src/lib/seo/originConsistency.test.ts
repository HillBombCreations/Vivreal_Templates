import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// Explicit .ts extensions: runs under `node --experimental-strip-types --test`,
// which has no tsconfig `paths` resolution.
import { toOriginSource } from '../api/siteData/originSource.ts';
import { buildRobotsPolicy } from './robotsPolicy.ts';
import { buildSiteMapForSite } from './siteMapPolicy.ts';
import { resolveRouteCanonical } from './routeMetadata.ts';
import { buildSiteJsonLd } from '../../components/JsonLd/schema.ts';
import { buildDetailUrl } from '../og/siteOrigin.ts';

// The one invariant this whole change exists to hold:
//
//   the page canonical, the robots.txt `Sitemap:` directive, every sitemap
//   `<loc>`, the JSON-LD `url` and every detail URL name the SAME origin.
//
// It was not held before. `getSiteData()` spread `siteDetails.values` (so it
// saw `canonicalUrl`), while `getSiteMap()` hand-built
// `{ domainName, domainInformation }` (so it did not). Widening only the
// resolver's type typechecked, passed the whole suite, and at cutover would
// have emitted a canonical and a `Sitemap:` on https://vivreal.io while all 29
// `<loc>` entries stayed on https://next.vivreal.io. Google discards a sitemap
// whose `<loc>` host differs from the submitting host, so the apex would have
// gone live with no submitted URL set at all (review-templates-106.md Trap 1).
//
// Both readers now build their input with `toOriginSource`, so these
// assertions are the executable form of that invariant.

const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
const ENV_LIFECYCLE = process.env.SITE_LIFECYCLE;
afterEach(() => {
  if (ENV_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ENV_SITE_URL;
  if (ENV_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ENV_LIFECYCLE;
});

const PAGES = [
  { slug: 'home', format: 'home' },
  { slug: 'about', format: 'about' },
  { slug: 'shows', format: 'shows' },
];

/** The exact raw VR_Client_API response shape both readers consume. */
const rawResponse = (values: Record<string, unknown>, top: Record<string, unknown> = {}) =>
  ({
    siteDetails: { schema: {}, values },
    name: 'Site',
    ...top,
  }) as unknown as Parameters<typeof toOriginSource>[0];

test('CUTOVER SHAPE: canonical, Sitemap: and every <loc> resolve to the SAME apex once canonicalUrl is persisted', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // The literal vivreal.io cutover state from design.md: the apex is persisted
  // as canonicalUrl while next.vivreal.io stays the physical Amplify host.
  const raw = rawResponse(
    { canonicalUrl: 'https://vivreal.io', lifecycleState: 'live' },
    { domainInformation: { live_url: 'https://next.vivreal.io' } },
  );
  const siteData = toOriginSource(raw);

  const canonical = resolveRouteCanonical(siteData, '/');
  const sitemapDirective = buildRobotsPolicy(siteData).sitemap;
  const locs = buildSiteMapForSite(siteData, PAGES).map((entry) => entry.url);
  const [organization] = buildSiteJsonLd(siteData);
  const detailUrl = buildDetailUrl(siteData, 'shows', 'abc123');

  assert.equal(canonical, 'https://vivreal.io');
  assert.equal(sitemapDirective, 'https://vivreal.io/sitemap.xml');
  assert.deepEqual(locs, [
    'https://vivreal.io',
    'https://vivreal.io/about',
    'https://vivreal.io/shows',
  ]);
  assert.equal(organization.url, 'https://vivreal.io');
  assert.equal(detailUrl, 'https://vivreal.io/shows/abc123');

  // Stated as the invariant, not just as five literals: nothing may still be
  // pointing at the physical staging host.
  const everyOrigin = new Set([
    canonical,
    sitemapDirective?.replace('/sitemap.xml', ''),
    ...locs.map((url) => new URL(url).origin),
    organization.url,
    detailUrl && new URL(detailUrl).origin,
  ]);
  assert.deepEqual([...everyOrigin], ['https://vivreal.io'], 'exactly one origin across every surface');
});

test('FLEET SHAPE (subdomain-only, no canonicalUrl): Sitemap: and <loc> agree, and the canonical stays absent', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // dougs-kitchen.com's shape: no domainName, no canonicalUrl. Before this
  // change it served no `Sitemap:` directive and a 0-entry sitemap.
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'live' }, { domainInformation: { live_url: 'https://dougs-kitchen.vivreal.io' } }),
  );
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://dougs-kitchen.vivreal.io/sitemap.xml');
  assert.deepEqual(
    buildSiteMapForSite(siteData, PAGES).map((e) => e.url),
    ['https://dougs-kitchen.vivreal.io', 'https://dougs-kitchen.vivreal.io/about', 'https://dougs-kitchen.vivreal.io/shows'],
  );
  assert.equal(
    resolveRouteCanonical(siteData, '/'),
    undefined,
    'no canonicalUrl authored ⇒ no canonical tag, byte-identical to before the field existed',
  );
});

test('FLEET SHAPE (legacy custom apex, no canonicalUrl): unchanged from today', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // comedycollectivechi.com's shape: domainName and live_url agree.
  const siteData = toOriginSource(
    rawResponse(
      { lifecycleState: 'live' },
      { domainName: 'comedycollectivechi.com', domainInformation: { live_url: 'https://comedycollectivechi.com' } },
    ),
  );
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://comedycollectivechi.com/sitemap.xml');
  assert.deepEqual(
    buildSiteMapForSite(siteData, PAGES).map((e) => e.url),
    ['https://comedycollectivechi.com', 'https://comedycollectivechi.com/about', 'https://comedycollectivechi.com/shows'],
  );
  assert.equal(resolveRouteCanonical(siteData, '/'), undefined);
});

test('toOriginSource carries EVERY siteDetails.values field, so a new origin field cannot reach one reader only', () => {
  // The structural guarantee, stated directly: this is a spread, not a
  // hand-listed Pick. A future `canonicalUrlOverride`-shaped field added to
  // siteDetails.values reaches getSiteData() and getSiteMap() together or not
  // at all.
  const siteData = toOriginSource(
    rawResponse(
      { canonicalUrl: 'https://vivreal.io', lifecycleState: 'live', someFutureOriginField: 'https://future.example' },
      { domainName: 'legacy.example', domainInformation: { live_url: 'https://next.vivreal.io' } },
    ),
  );
  assert.equal(siteData.canonicalUrl, 'https://vivreal.io');
  assert.equal(siteData.lifecycleState, 'live');
  assert.equal(
    (siteData as unknown as Record<string, unknown>).someFutureOriginField,
    'https://future.example',
    'an unknown values field still arrives',
  );
  // Top-level response fields win over anything of the same name in values.
  assert.equal(siteData.domainName, 'legacy.example');
  assert.equal(siteData.domainInformation?.live_url, 'https://next.vivreal.io');
});

test('a rolled-back cutover (canonicalUrl kept, lifecycleState back to demo) withholds every surface', () => {
  // design.md: rollback atomically returns lifecycleState=demo while KEEPING
  // canonicalUrl=https://vivreal.io. Nothing may still be advertising the apex.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(
    rawResponse(
      { canonicalUrl: 'https://vivreal.io', lifecycleState: 'demo' },
      { domainInformation: { live_url: 'https://next.vivreal.io' } },
    ),
  );
  assert.deepEqual(buildRobotsPolicy(siteData).rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(buildRobotsPolicy(siteData).sitemap, undefined);
  assert.deepEqual(buildSiteMapForSite(siteData, PAGES), []);
  assert.equal(resolveRouteCanonical(siteData, '/'), undefined);
  assert.equal(buildSiteJsonLd(siteData)[0].url, undefined);
});
