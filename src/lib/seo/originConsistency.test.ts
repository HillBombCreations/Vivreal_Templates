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
import { applyScheduleFeedUrl } from '../api/siteData/scheduleFeed.ts';

// The one invariant this whole change exists to hold:
//
//   the page canonical, the robots.txt `Sitemap:` directive, every sitemap
//   `<loc>`, the JSON-LD `url`, every detail URL AND the schedule feed
//   (`labels.icalFeedUrl`) name the SAME origin.
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
// The schedule feed joined this file rather than getting an isolated test of
// its own because it was missed the FIRST time for exactly that reason: it
// built `https://${domainName}/feeds/schedule.ics` from raw `domainName` while
// robots and the sitemap moved onto the resolver, so the fleet majority (a
// `domainInformation.live_url` and no `domainName`) got no feed URL at all and
// the Subscribe button had nothing to bind to. Asserting it beside the other
// surfaces is what stops the next surface from drifting the same way.
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

// A FACTORY, not a shared const: `applyScheduleFeedUrl` mutates `page.labels`
// in place (as the inline loop in getSiteData() always did), so a module-level
// array would carry one test's feed URL into the next and turn an "emits
// nothing" assertion green for the wrong reason.
const makePages = () => [
  { slug: 'home', format: 'home', labels: {} as Record<string, string> },
  { slug: 'about', format: 'about', labels: {} as Record<string, string> },
  { slug: 'shows', format: 'shows', labels: {} as Record<string, string> },
  { slug: 'schedule', format: 'schedule', labels: {} as Record<string, string> },
];

const SITEMAP_PATHS = ['', '/about', '/shows', '/schedule'];
const locsFor = (origin: string) => SITEMAP_PATHS.map((path) => `${origin}${path}`);

/**
 * Drive the REAL wiring `getSiteData()` performs and hand back the schedule
 * page's labels, so a test can assert both the emitted value and the ABSENCE
 * of the key. Not a re-implementation: this calls the same exported function
 * `getSiteData()` calls.
 */
const wireFeed = (
  siteData: Parameters<typeof applyScheduleFeedUrl>[1],
  pages: ReturnType<typeof makePages>,
): Record<string, string> => {
  applyScheduleFeedUrl(pages, siteData);
  const schedulePage = pages.find((p) => p.format === 'schedule');
  assert.ok(schedulePage, 'fixture must carry a schedule page');
  return schedulePage.labels;
};

/** The exact raw VR_Client_API response shape both readers consume. */
const rawResponse = (values: Record<string, unknown>, top: Record<string, unknown> = {}) =>
  ({
    siteDetails: { schema: {}, values },
    name: 'Site',
    ...top,
  }) as unknown as Parameters<typeof toOriginSource>[0];

test('CUTOVER SHAPE: canonical, Sitemap:, every <loc> and the schedule feed resolve to the SAME apex once canonicalUrl is persisted', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // The literal vivreal.io cutover state from design.md: the apex is persisted
  // as canonicalUrl while next.vivreal.io stays the physical Amplify host.
  const raw = rawResponse(
    { canonicalUrl: 'https://vivreal.io', lifecycleState: 'live' },
    { domainInformation: { live_url: 'https://next.vivreal.io' } },
  );
  const siteData = toOriginSource(raw);
  // ONE page list drives both the sitemap and the feed, so `<loc>` for
  // /schedule and the feed URL are provably built from the same input.
  const pages = makePages();

  const canonical = resolveRouteCanonical(siteData, '/');
  const sitemapDirective = buildRobotsPolicy(siteData).sitemap;
  const locs = buildSiteMapForSite(siteData, pages).map((entry) => entry.url);
  const [organization] = buildSiteJsonLd(siteData);
  const detailUrl = buildDetailUrl(siteData, 'shows', 'abc123');
  const feedUrl = wireFeed(siteData, pages).icalFeedUrl;

  assert.equal(canonical, 'https://vivreal.io');
  assert.equal(sitemapDirective, 'https://vivreal.io/sitemap.xml');
  assert.deepEqual(locs, locsFor('https://vivreal.io'));
  assert.equal(organization.url, 'https://vivreal.io');
  assert.equal(detailUrl, 'https://vivreal.io/shows/abc123');
  assert.equal(feedUrl, 'https://vivreal.io/feeds/schedule.ics');

  // Stated as the invariant, not just as six literals: nothing may still be
  // pointing at the physical staging host.
  const everyOrigin = new Set([
    canonical,
    sitemapDirective?.replace('/sitemap.xml', ''),
    ...locs.map((url) => new URL(url).origin),
    organization.url,
    detailUrl && new URL(detailUrl).origin,
    feedUrl && new URL(feedUrl).origin,
  ]);
  assert.deepEqual([...everyOrigin], ['https://vivreal.io'], 'exactly one origin across every surface');
});

test('FLEET SHAPE (subdomain-only, no canonicalUrl): Sitemap:, <loc> and the schedule feed agree, and the canonical stays absent', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // dougs-kitchen.com's shape: no domainName, no canonicalUrl. This is the
  // fleet MAJORITY and the case C1 broke: before the feed moved onto the
  // resolver it read raw `domainName`, found nothing, and emitted no feed URL
  // at all. Before the sitemap moved, the same site served no `Sitemap:`
  // directive and a 0-entry sitemap.
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'live' }, { domainInformation: { live_url: 'https://dougs-kitchen.vivreal.io' } }),
  );
  const pages = makePages();
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://dougs-kitchen.vivreal.io/sitemap.xml');
  assert.deepEqual(
    buildSiteMapForSite(siteData, pages).map((e) => e.url),
    locsFor('https://dougs-kitchen.vivreal.io'),
  );
  assert.equal(
    wireFeed(siteData, pages).icalFeedUrl,
    'https://dougs-kitchen.vivreal.io/feeds/schedule.ics',
    'a live_url-only site gets a working Subscribe button, which it never had',
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
  const pages = makePages();
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://comedycollectivechi.com/sitemap.xml');
  assert.deepEqual(
    buildSiteMapForSite(siteData, pages).map((e) => e.url),
    locsFor('https://comedycollectivechi.com'),
  );
  assert.equal(
    wireFeed(siteData, pages).icalFeedUrl,
    'https://comedycollectivechi.com/feeds/schedule.ics',
    'byte-identical to the raw-domainName string this site already served',
  );
  assert.equal(resolveRouteCanonical(siteData, '/'), undefined);
});

test('FEED: domainName-ONLY (no live_url) still resolves, byte-identical to the pre-resolver string', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // The legacy directly-attached-domain shape: level 4 of the chain is the
  // only level that answers. This is the one input the old raw-`domainName`
  // line got right, and it must keep producing the same bytes.
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'live' }, { domainName: 'acme-legacy.com' }),
  );
  const pages = makePages();
  assert.equal(wireFeed(siteData, pages).icalFeedUrl, 'https://acme-legacy.com/feeds/schedule.ics');
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://acme-legacy.com/sitemap.xml');
  assert.deepEqual(
    buildSiteMapForSite(siteData, pages).map((e) => e.url),
    locsFor('https://acme-legacy.com'),
  );
});

test('FEED: BOTH live_url and domainName present ⇒ live_url wins, exactly as the sitemap does', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // The two disagree on purpose. The old code read `domainName` directly and
  // would have wired the Subscribe button to https://legacy.example while every
  // crawler surface named https://next.vivreal.io. That is a split-brain the
  // visitor sees, not just the crawler.
  const siteData = toOriginSource(
    rawResponse(
      { lifecycleState: 'live' },
      { domainName: 'legacy.example', domainInformation: { live_url: 'https://next.vivreal.io' } },
    ),
  );
  const pages = makePages();
  const feedUrl = wireFeed(siteData, pages).icalFeedUrl;
  assert.equal(feedUrl, 'https://next.vivreal.io/feeds/schedule.ics');

  const sitemapOrigin = new URL(buildSiteMapForSite(siteData, pages)[0].url).origin;
  assert.equal(
    new URL(feedUrl).origin,
    sitemapOrigin,
    'the feed and the sitemap resolve one origin, not two',
  );
});

test('FEED: NEITHER live_url nor domainName ⇒ no icalFeedUrl key at all, never a malformed URL', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(rawResponse({ lifecycleState: 'live' }, {}));
  const pages = makePages();
  const labels = wireFeed(siteData, pages);

  // The KEY is absent, not present-and-undefined and certainly not
  // `https://undefined/feeds/schedule.ics`. `in` rather than a truthiness
  // check: a key set to `undefined` would pass the truthiness form.
  assert.equal('icalFeedUrl' in labels, false, 'no origin ⇒ nothing written');
  // Matches how the same branch already handles a missing route canonical.
  assert.equal(resolveRouteCanonical(siteData, '/'), undefined);
  assert.equal(buildRobotsPolicy(siteData).sitemap, undefined);
  assert.deepEqual(buildSiteMapForSite(siteData, pages), []);
});

test('FEED: an origin the HTTPS allowlist REFUSES emits nothing, and never leaks the raw value', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // Each of these is a value VR_Client_API can hand back and the allowlist
  // must refuse outright: a non-https scheme, a URL carrying a path, embedded
  // credentials, an explicit port, and a host that cannot resolve. With no
  // domainName to fall through to, every one must yield NO feed URL.
  for (const live_url of [
    'http://insecure.example',
    'https://acme.test/some/path',
    'https://user:pass@acme.test',
    'https://acme.test:8443',
    'https://localhost',
  ]) {
    const siteData = toOriginSource(
      rawResponse({ lifecycleState: 'live' }, { domainInformation: { live_url } }),
    );
    const labels = wireFeed(siteData, makePages());
    assert.equal('icalFeedUrl' in labels, false, `refused live_url must emit nothing: ${live_url}`);
  }
});

test('FEED: a REFUSED live_url falls through to a good domainName, same as every other surface', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // Filtering is per candidate, not after resolution: one bad level must not
  // discard a perfectly good lower one (siteOrigin.ts C4).
  const siteData = toOriginSource(
    rawResponse(
      { lifecycleState: 'live' },
      { domainName: 'acme.test', domainInformation: { live_url: 'https://acme.test/some/path' } },
    ),
  );
  const pages = makePages();
  assert.equal(wireFeed(siteData, pages).icalFeedUrl, 'https://acme.test/feeds/schedule.ics');
  assert.equal(buildRobotsPolicy(siteData).sitemap, 'https://acme.test/sitemap.xml');
});

test('FEED: an amplifyapp-only origin is refused, because a webcal subscription outlives the build host', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  // The feed resolves with surface:'durable', not 'deployed'. A visitor's
  // calendar client re-polls a webcal:// subscription indefinitely, which makes
  // it the longest-lived artifact that could carry an Amplify build host, so
  // it gets the same refusal robots and the sitemap get, and stays on the same
  // origin as them (here: none).
  const siteData = toOriginSource(
    rawResponse(
      { lifecycleState: 'live' },
      { domainInformation: { live_url: 'https://main.d2e6e3kdfrrxak.amplifyapp.com' } },
    ),
  );
  const pages = makePages();
  assert.equal('icalFeedUrl' in wireFeed(siteData, pages), false);
  assert.equal(buildRobotsPolicy(siteData).sitemap, undefined);
  assert.deepEqual(buildSiteMapForSite(siteData, pages), []);
});

test('FEED: only schedule-format pages are touched', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'live' }, { domainInformation: { live_url: 'https://acme.vivreal.io' } }),
  );
  const pages = makePages();
  applyScheduleFeedUrl(pages, siteData);

  for (const page of pages) {
    if (page.format === 'schedule') {
      assert.equal(page.labels.icalFeedUrl, 'https://acme.vivreal.io/feeds/schedule.ics');
    } else {
      assert.equal(
        'icalFeedUrl' in page.labels,
        false,
        `${page.slug} must keep the labels VR_Client_API returned`,
      );
    }
  }
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
  const pages = makePages();
  assert.deepEqual(buildRobotsPolicy(siteData).rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(buildRobotsPolicy(siteData).sitemap, undefined);
  assert.deepEqual(buildSiteMapForSite(siteData, pages), []);
  assert.equal(resolveRouteCanonical(siteData, '/'), undefined);
  assert.equal(buildSiteJsonLd(siteData)[0].url, undefined);

  // The feed is the ONE surface that still emits here, and that is correct: it
  // is a link the visitor clicks, not a crawler directive, so a demo whose
  // Subscribe button 404s would be a worse demo. What it must never do is name
  // the apex. `resolveSiteOrigin` demo-gates `canonicalUrl` and nothing else,
  // so the feed lands on the demo's own physical host.
  assert.equal(
    wireFeed(siteData, pages).icalFeedUrl,
    'https://next.vivreal.io/feeds/schedule.ics',
    'a rolled-back site must not advertise the apex anywhere, including the Subscribe button',
  );
});

// ── checkout result pages, across every real fleet input shape ───────────────
//
// `buildSitemapEntries` has its own unit tests for the exclusion. These prove
// it through the FULL wiring both `robots.tsx` and `sitemap.tsx` actually use —
// `toOriginSource` → `buildSiteMapForSite` (demo gate + resolver) → entries —
// against each of the five origin shapes the fleet really carries, because
// "the exclusion works but only on one origin shape" is the kind of gap that
// ships.

/** dougs-kitchen.com's real page list, verified live 2026-08-24. */
const makeCheckoutPages = () => [
  { slug: 'home', format: 'home' },
  { slug: 'products', format: 'products' },
  { slug: 'checkoutsuccess', format: 'checkout-success' },
  { slug: 'checkoutcancel', format: 'checkout-cancel' },
  { slug: 'about', format: 'about' },
];

const ORIGIN_SHAPES: Array<[string, Record<string, unknown>, Record<string, unknown>, string]> = [
  // [label, siteDetails.values, top-level response fields, expected origin]
  ['live_url only (fleet majority)', { lifecycleState: 'live' }, { domainInformation: { live_url: 'https://dougs-kitchen.vivreal.io' } }, 'https://dougs-kitchen.vivreal.io'],
  ['domainName only (legacy apex)', { lifecycleState: 'live' }, { domainName: 'comedycollectivechi.com' }, 'https://comedycollectivechi.com'],
  ['both present', { lifecycleState: 'live' }, { domainName: 'legacy.example', domainInformation: { live_url: 'https://next.vivreal.io' } }, 'https://next.vivreal.io'],
  ['canonicalUrl present (post-cutover)', { canonicalUrl: 'https://vivreal.io', lifecycleState: 'live' }, { domainInformation: { live_url: 'https://next.vivreal.io' } }, 'https://vivreal.io'],
];

test('SITEMAP: the checkout result pages are excluded on EVERY fleet origin shape, and nothing else is', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  for (const [label, values, top, origin] of ORIGIN_SHAPES) {
    const siteData = toOriginSource(rawResponse(values, top));
    const urls = buildSiteMapForSite(siteData, makeCheckoutPages()).map((e) => e.url);
    assert.deepEqual(
      urls,
      [origin, `${origin}/products`, `${origin}/about`],
      `${label}: checkout pages withheld, every content page kept`,
    );
  }
});

test('SITEMAP: NEITHER live_url nor domainName ⇒ still an empty sitemap, checkout pages or not', () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(rawResponse({ lifecycleState: 'live' }, {}));
  assert.deepEqual(buildSiteMapForSite(siteData, makeCheckoutPages()), []);
});

test('DEMO SAFETY: a demo store still emits a COMPLETELY empty sitemap, not a checkout-filtered one', () => {
  // The exclusion must not become a partial substitute for the demo gate. A
  // demo emits zero entries, including no root entry.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'demo' }, { domainInformation: { live_url: 'https://demo-store.vivreal.io' } }),
  );
  assert.deepEqual(buildSiteMapForSite(siteData, makeCheckoutPages()), []);
  assert.deepEqual(buildRobotsPolicy(siteData).rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(buildRobotsPolicy(siteData).sitemap, undefined);
});

test('the robots.txt Sitemap: directive and every remaining <loc> still name ONE origin after the exclusion', () => {
  // Removing entries must not disturb the invariant this file exists for.
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_LIFECYCLE;
  const siteData = toOriginSource(
    rawResponse({ lifecycleState: 'live' }, { domainInformation: { live_url: 'https://dougs-kitchen.vivreal.io' } }),
  );
  const locs = buildSiteMapForSite(siteData, makeCheckoutPages()).map((e) => new URL(e.url).origin);
  const directive = buildRobotsPolicy(siteData).sitemap;
  // Pins the directive AND narrows it off `string | string[]` for the strip
  // below, the same way the CUTOVER SHAPE test above does.
  assert.equal(directive, 'https://dougs-kitchen.vivreal.io/sitemap.xml');
  assert.deepEqual(
    [...new Set([...locs, directive.replace('/sitemap.xml', '')])],
    ['https://dougs-kitchen.vivreal.io'],
  );
});
