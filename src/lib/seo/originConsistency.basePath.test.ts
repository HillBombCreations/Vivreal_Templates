/**
 * TP-5 (release B, F270): every absolute address the help site writes names
 * `https://vivreal.io/help`, and the business entity stays on the origin.
 *
 * This process is the help app's build: `VIVREAL_SITE_BASE_PATH` is `/help`
 * (what `next.config.ts` inlines from `SITE_BASE_PATH`) and
 * `NEXT_PUBLIC_SITE_URL` is `https://vivreal.io` (SW-B-H4), both set before any
 * module reads them. The help record's own shape (BR-04 U2): no canonicalUrl,
 * live_url `https://help.vivreal.io`. Every other site builds with no base
 * path, and `originConsistency.test.ts` (and each builder's own suite) pins
 * those outputs unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.VIVREAL_SITE_BASE_PATH = '/help';
process.env.NEXT_PUBLIC_SITE_URL = 'https://vivreal.io';
delete process.env.SITE_LIFECYCLE;

const { toOriginSource } = await import('../api/siteData/originSource.ts');
const { resolveSiteOrigin, resolveSitePublicBase, buildDetailUrl } = await import('../og/siteOrigin.ts');
const { resolveRouteCanonical } = await import('./routeMetadata.ts');
const { buildRobotsPolicy } = await import('./robotsPolicy.ts');
const { buildSiteMapForSite } = await import('./siteMapPolicy.ts');
const { buildRootMetadata } = await import('./rootMetadata.ts');
const { buildSiteJsonLd, siteOrganizationId } = await import('../../components/JsonLd/schema.ts');
const { applyScheduleFeedUrl } = await import('../api/siteData/scheduleFeed.ts');
const { stableImageOrigin, itemImageUrl } = await import('../media/stableImage.ts');
const { snapshotPayload } = await import('../indexnow/snapshot.ts');
const { rootSitemapXml, SITEMAP_PAGE_SIZE } = await import('./sitemapXml.ts');
const { detailCrumbs } = await import('./breadcrumbs.ts');
const { breadcrumbListJsonLd } = await import('../../../node_modules/@hillbombcreations/site-renderer/dist/lib/breadcrumbs.js');

const HELP = 'https://vivreal.io/help';
const KEY = '0123456789abcdef0123456789abcdef';

/** The help site record's origin shape (pod_01.sites 6aa1b1a896bf3f53d9beeaea, BR-04 U2). */
const helpSite = () =>
  toOriginSource({
    siteDetails: { schema: {}, values: { lifecycleState: 'live', indexNowKey: KEY } },
    name: 'Vivreal Help',
    domainInformation: { live_url: 'https://help.vivreal.io' },
  } as unknown as Parameters<typeof toOriginSource>[0]); // the raw Client API shape, as originConsistency.test.ts builds it

const pages = () => [
  { slug: 'your-website', format: 'standard', labels: {} as Record<string, string> },
  { slug: 'schedule', format: 'schedule', labels: {} as Record<string, string> },
];

test('[TP-4 ALLOW] the public base is the origin plus /help; the origin itself is unchanged', () => {
  const site = helpSite();
  assert.equal(resolveSiteOrigin(site, { surface: 'durable' }), 'https://vivreal.io');
  assert.equal(resolveSitePublicBase(site, { surface: 'durable' }), HELP);
  assert.equal(resolveSitePublicBase(site, { surface: 'deployed' }), HELP);
});

test('[TP-4 REFUSE] no origin resolves: the public base is empty, never a bare /help', () => {
  const prior = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  try {
    assert.equal(resolveSitePublicBase(null, { surface: 'durable' }), '');
  } finally {
    process.env.NEXT_PUBLIC_SITE_URL = prior;
  }
});

test('[TP-5 ALLOW] canonical, Sitemap:, every <loc>, WebSite url, detail url, feed, image route all name /help', () => {
  const site = helpSite();
  const list = pages();
  applyScheduleFeedUrl(list, site);
  const [organization] = buildSiteJsonLd(site);

  assert.equal(resolveRouteCanonical(site, '/'), HELP);
  assert.equal(resolveRouteCanonical(site, '/your-website/site-dashboard'), `${HELP}/your-website/site-dashboard`);
  assert.equal(buildRobotsPolicy(site).sitemap, `${HELP}/sitemap.xml`);
  assert.deepEqual(
    buildSiteMapForSite(site, list).map((entry) => entry.url),
    [HELP, `${HELP}/your-website`, `${HELP}/schedule`],
  );
  assert.equal(organization.url, HELP);
  assert.equal(buildDetailUrl(site, 'your-website', 'abc'), `${HELP}/your-website/abc`);
  assert.equal(list[1].labels.icalFeedUrl, `${HELP}/feeds/schedule.ics`);
  assert.equal(itemImageUrl(stableImageOrigin(site), 'your-website', 'abc'), `${HELP}/img/your-website/abc`);
});

test('[TP-5 ALLOW] metadataBase carries /help, so Next joins relative metadata under it', () => {
  const metadata = buildRootMetadata({ ...helpSite(), favicon: undefined } as Parameters<typeof buildRootMetadata>[0]); // only the origin fields are read on this path
  assert.ok(metadata.metadataBase instanceof URL);
  assert.equal(metadata.metadataBase.href, `${HELP}`);
});

test('[TP-5 ALLOW] IndexNow: the key file under /help on the vivreal.io host', () => {
  const payload = snapshotPayload(helpSite(), [{ url: HELP }]);
  assert.equal(payload.eligible, true);
  if (!payload.eligible) return;
  assert.equal(payload.host, 'vivreal.io');
  assert.equal(payload.keyLocation, `${HELP}/${KEY}.txt`);
});

test('[TP-5 ALLOW] a sitemap index past the page size points at /help/sitemaps/<n>.xml', () => {
  const entries = Array.from({ length: SITEMAP_PAGE_SIZE + 1 }, (_, i) => ({ url: `${HELP}/p${i}` }));
  const xml = rootSitemapXml(entries);
  assert.match(xml, /<loc>https:\/\/vivreal\.io\/help\/sitemaps\/1\.xml<\/loc>/);
  assert.match(xml, /<loc>https:\/\/vivreal\.io\/help\/sitemaps\/2\.xml<\/loc>/);
  assert.doesNotMatch(xml, /<loc>https:\/\/vivreal\.io\/sitemaps\//);
});

test('[TP-5 ALLOW] a detail breadcrumb trail names /help at every step', () => {
  const trail = breadcrumbListJsonLd(
    resolveSiteOrigin(helpSite(), { surface: 'durable' }),
    detailCrumbs({ page: { name: 'Your website', labels: {} }, slug: 'your-website', itemSegment: 'site-dashboard', itemName: 'Site dashboard' }),
  );
  assert.ok(trail);
  assert.deepEqual(
    trail.itemListElement.map((item: { item: string }) => item.item),
    [HELP, `${HELP}/your-website`, `${HELP}/your-website/site-dashboard`],
  );
});

test('[TP-5 REFUSE] no address the help site publishes lacks /help', () => {
  const site = helpSite();
  const list = pages();
  applyScheduleFeedUrl(list, site);
  const published = [
    resolveRouteCanonical(site, '/'),
    resolveRouteCanonical(site, '/your-website'),
    buildRobotsPolicy(site).sitemap,
    ...buildSiteMapForSite(site, list).map((entry) => entry.url),
    buildSiteJsonLd(site)[0].url,
    buildDetailUrl(site, 'your-website', 'abc'),
    list[1].labels.icalFeedUrl,
  ];
  for (const url of published) {
    assert.ok(typeof url === 'string' && url.startsWith(HELP), `${String(url)} names the help base`);
  }
});

test('[TP-5 REFUSE] #organization never gains /help: one business entity across vivreal.io', () => {
  assert.equal(siteOrganizationId(helpSite()), 'https://vivreal.io/#organization');
});
