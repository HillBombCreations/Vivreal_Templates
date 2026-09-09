import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PageConfig, SiteData } from '@/types/SiteData';
// Explicit .ts extensions: runs under `node --experimental-strip-types --test`
// (see package.json "test"), which has no tsconfig `paths` resolution.
import { isDemoSite } from './demoSafety.ts';
import { buildRobotsPolicy } from './robotsPolicy.ts';
import { buildSiteMapForSite } from './siteMapPolicy.ts';
import { buildRootMetadata } from './rootMetadata.ts';
import { FALLBACK_SITE_DATA } from '../api/siteData/fallback.ts';
import {
  DegradedUpstreamError,
  assertUpstreamHealthy,
  isDegradedSiteData,
} from '../api/siteData/degraded.ts';

/**
 * THE DEGRADED RENDER MUST NOT DEINDEX THE SITE.
 *
 * When VR_Client_API degrades, `clientFetchCached` swallows the error and
 * `getSiteData()` hands back `FALLBACK_SITE_DATA`. Until this suite existed
 * that constant carried `lifecycleState: 'demo'` and `pageConfigs: []`, so for
 * the duration of any upstream wobble the site told every crawler three
 * separate untruths at once:
 *
 *   - `robots.txt` said `Disallow: /`
 *   - every page said `noindex, nofollow`
 *   - every healthy page answered 404
 *
 * All three are POSITIVE claims manufactured out of an ABSENCE of data. The
 * truth in that state is "we do not know", and the honest way to say that over
 * HTTP is a 5xx, which crawlers read as "come back later" and which removes
 * nothing from an index.
 *
 * This is not a theoretical shape. `vivreal.io` lost ten days of indexing to a
 * `lifecycleState` that read `demo` when it should have read `live`
 * (vivreal-hq: open-findings-ledger.md row 24, and the
 * `vivreal-io-is-a-templates-site` incident note). The degraded path reproduced
 * that by itself, under load, with nobody touching anything.
 *
 * The suite deliberately pins BOTH directions. Weakening the real demo gate
 * would be a worse bug than the one being fixed: an indexed demo is live
 * duplicate-content exposure against the prospect we are courting, and unlike a
 * deindexing it cannot be undone by the upstream recovering.
 */

const ENV_LIFECYCLE = process.env.SITE_LIFECYCLE;
const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (ENV_LIFECYCLE === undefined) delete process.env.SITE_LIFECYCLE;
  else process.env.SITE_LIFECYCLE = ENV_LIFECYCLE;
  if (ENV_SITE_URL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ENV_SITE_URL;
});

const PAGES: Pick<PageConfig, 'slug' | 'format' | 'detailPage' | 'seo'>[] = [
  { slug: 'about', format: 'standard' },
  { slug: 'shows', format: 'list' },
];

/** A genuine, healthy demo site read from real data. */
const REAL_DEMO: SiteData = {
  lifecycleState: 'demo',
  canonicalUrl: 'https://classichousephx.vivreal.io',
  domainName: 'classichousephx.vivreal.io',
} as SiteData;

/** A genuine, healthy live site read from real data. */
const REAL_LIVE: SiteData = {
  lifecycleState: 'live',
  canonicalUrl: 'https://classichousephx.vivreal.io',
  domainName: 'classichousephx.vivreal.io',
} as SiteData;

// ---------------------------------------------------------------------------
// The marker itself
// ---------------------------------------------------------------------------

test('the fallback constant makes NO lifecycle claim, and marks itself degraded instead', () => {
  assert.equal(
    FALLBACK_SITE_DATA.lifecycleState,
    undefined,
    'a fallback constant must never assert a lifecycle it did not read from data',
  );
  assert.equal(isDegradedSiteData(FALLBACK_SITE_DATA), true);
});

test('real site data is never mistaken for degraded data', () => {
  assert.equal(isDegradedSiteData(REAL_DEMO), false);
  assert.equal(isDegradedSiteData(REAL_LIVE), false);
  assert.equal(isDegradedSiteData({} as SiteData), false);
  assert.equal(isDegradedSiteData(undefined), false);
  assert.equal(isDegradedSiteData(null), false);
});

// ---------------------------------------------------------------------------
// The three untruths, one test each
// ---------------------------------------------------------------------------

test('DEGRADED: robots.txt does NOT answer `Disallow: /`, it refuses to answer at all', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.throws(
    () => buildRobotsPolicy(FALLBACK_SITE_DATA),
    DegradedUpstreamError,
    'a degraded robots.txt must 5xx, never serve an authoritative site-wide Disallow',
  );
});

test('DEGRADED: the root metadata carries NO robots directive at all', () => {
  delete process.env.SITE_LIFECYCLE;
  const metadata = buildRootMetadata(FALLBACK_SITE_DATA);
  assert.equal(
    metadata.robots,
    undefined,
    'no noindex, and no index either. A degraded render asserts nothing about indexing',
  );
});

test('DEGRADED: the sitemap refuses rather than serving a successful empty list', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.throws(
    () => buildSiteMapForSite(FALLBACK_SITE_DATA, PAGES),
    DegradedUpstreamError,
    'an empty sitemap is a SUCCESSFUL render of a legitimately empty list, so nothing ever expires it',
  );
});

test('DEGRADED: a page that exists is not declared missing', () => {
  assert.throws(
    () => assertUpstreamHealthy(FALLBACK_SITE_DATA),
    DegradedUpstreamError,
    '`pageConfigs: []` means "we could not read the pages", never "this page does not exist"',
  );
});

test('the refusal is a 5xx-shaped signal, not a 404 and not a redirect', () => {
  try {
    assertUpstreamHealthy(FALLBACK_SITE_DATA);
    assert.fail('expected a throw');
  } catch (err) {
    assert.ok(err instanceof DegradedUpstreamError);
    // `digest` is how Next tags framework control-flow throws (NEXT_HTTP_ERROR_FALLBACK;*).
    // This must never carry one: a digest would let Next convert the refusal
    // into the very 404 this whole suite exists to prevent.
    assert.equal(
      (err as Error & { digest?: string }).digest,
      undefined,
      'must not impersonate a Next notFound()/redirect control-flow throw',
    );
  }
});

// ---------------------------------------------------------------------------
// The real demo gate is UNCHANGED. This half matters as much as the half above.
// ---------------------------------------------------------------------------

test('REAL DEMO still gets Disallow: /, and the fix must not un-gate a genuine demo', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.deepEqual(buildRobotsPolicy(REAL_DEMO).rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(buildRobotsPolicy(REAL_DEMO).sitemap, undefined);
});

test('REAL DEMO still gets noindex, nofollow and an empty sitemap', () => {
  delete process.env.SITE_LIFECYCLE;
  assert.deepEqual(buildRootMetadata(REAL_DEMO).robots, { index: false, follow: false });
  assert.deepEqual(buildSiteMapForSite(REAL_DEMO, PAGES), []);
});

test('REAL DEMO renders normally, because a demo is healthy and nothing refuses', () => {
  assert.doesNotThrow(() => assertUpstreamHealthy(REAL_DEMO));
});

test('REAL LIVE site stays fully indexable', () => {
  delete process.env.SITE_LIFECYCLE;
  const policy = buildRobotsPolicy(REAL_LIVE);
  assert.equal(policy.sitemap, 'https://classichousephx.vivreal.io/sitemap.xml');
  assert.deepEqual(
    (policy.rules as { userAgent: string; allow?: string }[])[0].allow,
    '/',
    'the wildcard rule still allows the site',
  );
  assert.equal(buildRootMetadata(REAL_LIVE).robots, undefined);
  // The two authored pages plus the root `/` entry (see buildSitemapEntries).
  const entries = buildSiteMapForSite(REAL_LIVE, PAGES);
  assert.equal(entries.length, 3);
  assert.ok(
    entries.some((e) => e.url === 'https://classichousephx.vivreal.io'),
    'the root entry is still submitted',
  );
  assert.doesNotThrow(() => assertUpstreamHealthy(REAL_LIVE));
});

// ---------------------------------------------------------------------------
// The safety net for anything this fix did not reach
// ---------------------------------------------------------------------------

test('SAFETY NET: isDemoSite still fails CLOSED on degraded data', () => {
  // The four durable surfaces above refuse before they ever consult the demo
  // gate, so none of them can emit a wrong claim. But `isDemoSite` is exported
  // and a future caller may not be degraded-aware. For that caller the OLD
  // fail-closed behaviour is still the right answer, because the alternative
  // (an outage silently un-gating every demo in the fleet onto a prospect's
  // duplicate content) is the one failure that cannot be undone by recovery.
  delete process.env.SITE_LIFECYCLE;
  assert.equal(
    isDemoSite(FALLBACK_SITE_DATA),
    true,
    'unknown data must never read as "definitely indexable"',
  );
});

// ---------------------------------------------------------------------------
// Source pins for the two call sites a plain-Node test cannot execute
// ---------------------------------------------------------------------------

test('SOURCE PIN: the [slug] route asserts upstream health BEFORE it can notFound()', () => {
  // `[slug]/page.tsx` is JSX and imports `server-only`, so this suite cannot
  // call it. Same pinning convention as renderMode.test.ts:480 and
  // cacheTags.test.ts:94, and for the same reason: mutation testing proved a
  // deleted gate leaves the whole suite green.
  const source = readFileSync(
    new URL('../../app/[slug]/page.tsx', import.meta.url),
    'utf8',
  );
  const guardAt = source.indexOf('assertUpstreamHealthy(siteData)');
  assert.ok(guardAt > 0, 'the [slug] route must call assertUpstreamHealthy(siteData)');

  const firstNotFoundAt = source.indexOf('return notFound()');
  assert.ok(firstNotFoundAt > 0, 'sanity: the route still has a notFound() to guard');
  assert.ok(
    guardAt < firstNotFoundAt,
    'the health assertion must run BEFORE any notFound(), or a degraded render 404s a page that exists',
  );
});

test('SOURCE PIN: getSiteData still takes the degraded render off both caches', () => {
  // Unchanged by this fix, and load-bearing: ISR migration Phase 4 blocker 1.
  // Pinned here too so a future edit to the degraded branch cannot quietly drop
  // it while this suite still passes.
  const source = readFileSync(
    new URL('../api/siteData/index.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    source.includes('await bailOutOfCachingDegradedRender();'),
    'a degraded render must still enter neither the Next page cache nor CloudFront',
  );
});
