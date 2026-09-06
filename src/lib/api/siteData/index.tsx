import 'server-only';
import type { MetadataRoute } from 'next';
import type {
  HomeSection,
  PageCollectionBinding,
  PageConfig,
  PageIntegrationBinding,
  SiteData,
} from '@/types/SiteData';
import * as Sentry from '@sentry/nextjs';
import { clientFetchCached, SITE_CACHE_TTL_SECONDS } from '@/lib/api/client';
import {
  ORIGIN_REFUSAL_MESSAGE,
  SITE_DETAILS_FALLBACK_MESSAGE,
  buildOriginRefusalCapture,
  buildSiteDetailsFallbackCapture,
} from '@/lib/api/errorCapture';
import { isRefusedOrigin, resolveSiteOriginResult } from '@/lib/og/ogImage';
import { pageDetailCollectionId } from '@/lib/detail/detailCollection';
import { bailOutOfCachingDegradedRender } from '@/lib/renderGate';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { buildSiteMapForSite } from '@/lib/seo/siteMapPolicy';
import { toOriginSource } from './originSource';
import { applyScheduleFeedUrl } from './scheduleFeed';
import { FALLBACK_SITE_DATA } from './fallback';
import { getCollectionItems } from '@/lib/api/collections';
import { applyScope, itemSegment } from '@hillbombcreations/site-renderer';

const SITE_ID = process.env.SITE_ID || '';

// Site chrome (theme, nav, footer, page configs) changes rarely, but the
// siteDetails read is hit on EVERY page render of EVERY site. Cache it so
// crawler/traffic bursts are served from the Next.js Data Cache instead of
// re-hitting VR_Client_API (and Mongo) per render. TTL is env-gated via
// SITE_CACHE_TTL_SECONDS (default 60 — well under VR_Client_API's 300s signed
// media-URL TTL; raising it to 86400 requires first raising that signed-URL
// TTL, per the enable runbook). Preview requests bypass the cache entirely.
const SITE_DETAILS_REVALIDATE_SECONDS = SITE_CACHE_TTL_SECONDS;

// Cache tag for site-chrome reads. The site's /api/revalidate route invalidates
// this tag on site.* (Studio save) and collection.* webhook events, so a chrome
// edit is reflected on the next render without waiting for the time backstop.
const SITE_CHROME_TAG = SITE_ID ? [`site:${SITE_ID}`] : undefined;

interface SiteDetailsResponse {
  siteDetails: {
    schema: object;
    values: SiteData;
  };
  name: string;
  domainName: string;
  domainInformation?: { live_url?: string };
  businessInfo?: SiteData['businessInfo'];
  aboutSection?: SiteData['aboutSection'];
  socialLinks?: SiteData['socialLinks'];
  pages?: PageConfig[];
  homeSections?: HomeSection[];
  // Carries templateType used to gate template-specific UI (e.g., restaurant
  // FloatingCta in app/layout.tsx). Added to VR_Client_API getSiteDetails
  // service 2026-04-18.
  siteInfo?: SiteData['siteInfo'];
  // Q3b — Studio-authored navbar/footer chrome. Returned by VR_Client_API
  // getSiteDetails (null/absent ⇒ chrome auto-derives).
  navigation?: SiteData['navigation'];
  footer?: SiteData['footer'];
  // CC9 — Studio-authored email-capture popup config. Returned by VR_Client_API
  // getSiteDetails (null/absent ⇒ legacy popup behavior).
  emailPopup?: SiteData['emailPopup'];
  // Site-level announcement/promo strip (null/absent ⇒ no strip).
  announcement?: SiteData['announcement'];
  // Utility strip — slim persistent info bar in the fixed header (identity
  // kits §5.3; null/absent ⇒ no strip).
  utilityStrip?: SiteData['utilityStrip'];
  // Fulfillment strip — the Ansel-kit viewport-bottom channel pill (bakery
  // template #3; null/absent ⇒ no strip).
  fulfillmentStrip?: SiteData['fulfillmentStrip'];
  utilityDock?: SiteData['utilityDock'];
  edgeDock?: SiteData['edgeDock'];
  // Phase 0 (two-axis-detail-route-design.md §5.1) — the WS3 301 redirect
  // map. Not currently forwarded top-level by VR_Client_API's getSiteDetails
  // (unlike navigation/footer/emailPopup); the migrator persists it only
  // inside `siteDetails.values`, so this optional top-level field exists
  // solely for forward-compat with the announcement/utilityStrip precedent
  // below (raw.X ?? values.X) should a future portal-authored surface add it.
  redirects?: SiteData['redirects'];
  tier?: string;
}

export const getSiteData = async (): Promise<SiteData> => {
  const raw = await clientFetchCached<SiteDetailsResponse | null>(
    `/tenant/siteDetails?siteId=${encodeURIComponent(SITE_ID)}`,
    null,
    SITE_DETAILS_REVALIDATE_SECONDS,
    undefined,
    SITE_CHROME_TAG
  );

  if (!raw?.siteDetails?.values) {
    // TRAIN-1.54.0 gap 2a. Taking this branch means the visitor is being served
    // a black-and-white page with no nav, no content and no logo - the exact
    // render the 2026-08-20 screenshot run photographed, which nobody was paged
    // for because this line was silent. It is a DISTINCT signal from the fetch
    // failure captured in client.ts: that one says "an upstream read failed",
    // this one says "a customer's site is live and empty", which is the
    // condition worth an alert rule.
    //
    // captureMessage rather than captureException because there is no error
    // object left here by design - clientFetchCached already swallowed it and
    // handed back the `null` fallback (see the capture at that swallow for the
    // ApiError and its status). Matches VR_Client_Auth's `unmapped_tier`
    // precedent for the same shape of condition.
    Sentry.captureMessage(
      SITE_DETAILS_FALLBACK_MESSAGE,
      buildSiteDetailsFallbackCapture({ siteId: SITE_ID })
    );
    // ISR migration Phase 4, blocker 1. Take THIS render off both caches before
    // handing back the placeholder. Without it the degraded page is emitted with
    // `s-maxage=300, stale-while-revalidate=<expireTime>` and pinned at the
    // CloudFront edge, which no `revalidateTag` can reach (Spike B): on
    // 2026-08-31 a 5m41s upstream outage produced 9m46s of a broken customer
    // home page.
    //
    // It belongs HERE, at the one place the degraded value is produced, so every
    // route that reads it is covered without seven separate edits. It must NOT
    // move to `!homePageConfig` in page.tsx: a site with no Studio home config
    // takes that branch with perfectly healthy data and belongs in the cache.
    //
    // What Next actually does with this is not the obvious thing — see
    // `optOutOfCachingDegradedRender` in `src/lib/renderMode.ts`.
    await bailOutOfCachingDegradedRender();
    return FALLBACK_SITE_DATA;
  }

  const allPages = raw.pages ?? [];
  const homePageConfig = allPages.find(
    (p) => p.format === "home" || p.slug === "home"
  );

  const pageConfigs = allPages.filter(
    (p) => p.format !== "home" && p.slug !== "home"
  );

  // The origin-deciding fields come from ONE shared constructor that
  // getSiteMap() also calls, so a canonical, a sitemap and a schedule feed can
  // never resolve different hosts. See ./originSource.ts.
  const originSource = toOriginSource(raw);

  // review-templates-106.md C5 — the origin refusal used to be SILENT. The
  // resolver returns '' with no log and no breadcrumb, and the four durable
  // surfaces (canonical, robots.txt `Sitemap:`, sitemap `<loc>`, the schedule
  // feed) then emit nothing at all. That is the same silent-absence class as
  // the empty-sitemap defect those surfaces were just fixed for, and an
  // operator who saw it would reasonably conclude the fix had not deployed.
  //
  // The report happens HERE and not in the resolver because
  // `src/lib/og/siteOrigin.ts` must stay loadable by `node
  // --experimental-strip-types --test` — a Sentry import would cost it its
  // whole behavioural suite, which is the only thing pinning the demo gates
  // (B2). The resolver hands back the reason as data; this module already
  // imports Sentry and is the ONE place `originSource` is built, so a single
  // capture covers every surface that resolves from it.
  //
  // `isRefusedOrigin`, not `origin === ''`: a site that simply has no domain
  // yet (and the local/preview build) is not misconfigured, and paging on it
  // would bury the real signal.
  const durableOrigin = resolveSiteOriginResult(originSource, { surface: 'durable' });
  if (isRefusedOrigin(durableOrigin)) {
    Sentry.captureMessage(
      ORIGIN_REFUSAL_MESSAGE,
      buildOriginRefusalCapture({
        siteId: SITE_ID,
        surface: 'durable',
        refused: durableOrigin.refused,
      }),
    );
  }

  // Wire the renderer's Schedule "Subscribe" button. The renderer reads
  // page.labels.icalFeedUrl and rewrites https:// → webcal://, so it MUST be an
  // absolute https URL on the site's public origin (a relative URL would not
  // survive the webcal rewrite). The URL points at this site's own
  // /feeds/schedule.ics proxy route (same origin).
  //
  // C1: this read raw `domainName`, which the fleet majority does not have.
  // Those sites carry a `domainInformation.live_url` instead, so their Subscribe
  // button had nothing to bind to at all. Same defect class as the empty-sitemap
  // bug. It now resolves through the SAME chain robots, the sitemap and the
  // canonical use, and still emits nothing at all when no origin resolves.
  // See ./scheduleFeed.ts.
  applyScheduleFeedUrl(pageConfigs, originSource);

  return {
    ...originSource,
    name: raw.name,
    businessInfo: raw.businessInfo ?? raw.siteDetails.values.businessInfo,
    aboutSection: raw.aboutSection,
    socialLinks: raw.socialLinks ?? [],
    pageConfigs,
    homePageConfig: homePageConfig ?? null,
    homeSections: raw.homeSections,
    // Thread siteInfo through so layout can read templateType. Fall back to
    // values.siteInfo for backward-compat with older responses that may only
    // carry it inside siteDetails.values.
    siteInfo: raw.siteInfo ?? raw.siteDetails.values.siteInfo,
    // Q3b — Studio-authored navbar/footer chrome (null ⇒ renderer auto-derives).
    navigation: raw.navigation ?? null,
    footer: raw.footer ?? null,
    // CC9 — Studio-authored email-capture popup config (null ⇒ legacy behavior).
    emailPopup: raw.emailPopup ?? null,
    // Announcement strip: top-level response field wins (emailPopup precedent);
    // falls back to a values-carried config so neither storage location
    // silently nulls it (the emailPopup values-only-emit gotcha).
    announcement:
      raw.announcement ?? (raw.siteDetails.values as SiteData).announcement ?? null,
    // Utility strip: same dual-source read as announcement (top-level wins,
    // values fallback — the emailPopup values-only-emit gotcha).
    utilityStrip:
      raw.utilityStrip ?? (raw.siteDetails.values as SiteData).utilityStrip ?? null,
    // Fulfillment strip (Ansel kit, bakery template #3): same dual-source read.
    fulfillmentStrip:
      raw.fulfillmentStrip ?? (raw.siteDetails.values as SiteData).fulfillmentStrip ?? null,
    // Coastal Estate kit — same dual-read as fulfillmentStrip/emailPopup
    // (HANDOFF gotcha #2: top-level wins, `values` is the fallback). Omitting
    // this mapping would silently null the dock even when the bundle emits it.
    utilityDock:
      raw.utilityDock ?? (raw.siteDetails.values as SiteData).utilityDock ?? null,
    // Med-spa kit look #1 — the SAME dual-read for the same reason. This is
    // the mapping whose omission is invisible: the loader writes the rail, the
    // bundle emits it, the preview shows it, and the live site renders nothing.
    edgeDock:
      raw.edgeDock ?? (raw.siteDetails.values as SiteData).edgeDock ?? null,
    // Phase 0 (two-axis-detail-route-design.md §5.1) — the WS3 301 redirect
    // map. Same dual-source read as the strips above (top-level wins, values
    // is the fallback); today only the values path is ever populated (the
    // migrator's createSite.js writes it into siteDetailsVal), but the dual
    // read costs nothing and matches every other flat-persisted field's
    // contract. Absent/empty ⇒ [] — [slug]/page.tsx and [slug]/[itemId]/
    // page.tsx's resolveRedirect() no-ops on an empty array with zero extra
    // work on the hot 404 path.
    redirects:
      raw.redirects ?? (raw.siteDetails.values as SiteData).redirects ?? [],
    // W10.3 — site-wide default share image. Read from `values` ONLY (no
    // top-level fallback): unlike the strips it is a MEDIA descriptor, and
    // `values` is the only place VR_Client_API's mediaFields registry can reach
    // to sign it. A top-level copy would arrive unsigned and render nothing.
    defaultOgImage: (raw.siteDetails.values as SiteData).defaultOgImage,
    tier: raw.tier,
  };
};

/**
 * Helper to find a page config by name and read a label with a fallback.
 */
export const getPageLabel = (
  siteData: SiteData,
  pageName: string,
  labelKey: string,
  fallback: string
): string => {
  const page = siteData.pageConfigs?.find((p) => p.name === pageName);
  return page?.labels?.[labelKey] || fallback;
};

/**
 * Helper to get a collection ID from page config, falling back to env var.
 *
 * The resolution itself lives in `src/lib/detail/detailCollection.ts` —
 * extracted, because this module imports `server-only` and Sentry, so nothing
 * written inline here can ever be tested by being CALLED (same split as
 * `src/lib/detail/detailFormats.ts` and `src/lib/seo/pageIndexing.ts`). That
 * file is also the twin of `Vivreal_Portal_Mobile`'s `detailCollectionId`, and
 * a cross-repo test calls both: the portal decides whether to offer a Copy link
 * button and this repo decides whether the link resolves, so a disagreement is
 * a 404 in front of her followers.
 *
 * Resolution order (see that file for why each clause is where it is):
 *   1. Page-template block binding (blocks-first, post-SP-3 backfill)
 *   2. Legacy page.collectionId (pre-SP-7 fallback)
 *   3. Legacy page.collections[0].collectionId (pre-SP-7 fallback)
 *   4. The first bound CONTENT block's `bindings[0]`
 *   5. Env-var fallback (Comedy Collective / EastTenn SHOWS_ID / TEAMMEMBERS_ID)
 *
 * Clause 4 is new and sits BEHIND the legacy mirrors on purpose: every page
 * that resolved to a collection before resolves to the same one now, so this
 * stays the additive superset it was. It reaches only pages that previously
 * fell through to `envFallback` — which for a `recipes` or `collection-list`
 * page is `''`, and was the whole Recipes 404.
 *
 * Un-migrated sites (no blocks) behave identically to before this change.
 * SP-7 can safely $unset collectionId + collections once all sites are backfilled.
 */
export const getPageCollectionId = (
  siteData: SiteData,
  pageName: string,
  envFallback: string
): string => {
  const page = siteData.pageConfigs?.find((p) => p.name === pageName);
  if (!page) return envFallback;
  return pageDetailCollectionId(page) || envFallback;
};

/**
 * Check if a page has a specific integration binding (by type or name).
 */
export const pageHasIntegration = (
  siteData: SiteData,
  pageName: string,
  integrationType: string
): boolean => {
  const page = siteData.pageConfigs?.find((p) => p.name === pageName);
  if (!page?.integrations?.length) return false;
  const lower = integrationType.toLowerCase();
  return page.integrations.some(
    (i) => (i.type ?? i.name ?? '').toLowerCase() === lower
  );
};

/**
 * Check if any page in the site has a specific integration binding.
 */
export const siteHasIntegration = (
  siteData: SiteData,
  integrationType: string
): boolean => {
  const lower = integrationType.toLowerCase();
  return (siteData.pageConfigs ?? []).some((page) =>
    (page.integrations ?? []).some(
      (i) => (i.type ?? i.name ?? '').toLowerCase() === lower
    )
  );
};

/**
 * Group a page's collection and integration bindings by their role.
 * Bindings without an explicit role default to 'primary'.
 */
export function getPageBindingsByRole(pageConfig: PageConfig): {
  primary: { collections: PageCollectionBinding[]; integrations: PageIntegrationBinding[] };
  secondary: { collections: PageCollectionBinding[]; integrations: PageIntegrationBinding[] };
  supplemental: { collections: PageCollectionBinding[]; integrations: PageIntegrationBinding[] };
  sidebar: { collections: PageCollectionBinding[]; integrations: PageIntegrationBinding[] };
} {
  const collections = pageConfig.collections ?? [];
  const integrations = pageConfig.integrations ?? [];

  return {
    primary: {
      collections: collections.filter((c) => (c.role ?? 'primary') === 'primary'),
      integrations: integrations.filter((i) => (i.role ?? 'primary') === 'primary'),
    },
    secondary: {
      collections: collections.filter((c) => c.role === 'secondary'),
      integrations: integrations.filter((i) => i.role === 'secondary'),
    },
    supplemental: {
      collections: collections.filter((c) => c.role === 'supplemental'),
      integrations: integrations.filter((i) => i.role === 'supplemental'),
    },
    sidebar: {
      collections: collections.filter((c) => c.role === 'sidebar'),
      integrations: integrations.filter((i) => i.role === 'sidebar'),
    },
  };
}

export const getSiteMap = async (): Promise<MetadataRoute.Sitemap> => {
  const raw = await clientFetchCached<SiteDetailsResponse | null>(
    `/tenant/siteDetails?siteId=${encodeURIComponent(SITE_ID)}`,
    null,
    SITE_DETAILS_REVALIDATE_SECONDS,
    undefined,
    SITE_CHROME_TAG
  );

  // No response, or a response with no `siteDetails.values`, means we cannot
  // tell a demo from a live site. getSiteData() resolves that same condition to
  // FALLBACK_SITE_DATA, which carries no origin and an explicit demo
  // lifecycleState, so both readers agree on an empty sitemap here.
  if (!raw?.siteDetails?.values) {
    // ISR migration Phase 4, blocker 1, completed. This is the SAME degraded
    // condition getSiteData() bails on twenty lines up, and it was the one
    // reader left behind when that fix was scoped to "these two only".
    //
    // Why it matters despite sitemap.xml never being edge-cached: a metadata
    // route is still PRERENDERED. In the outage build this was the single
    // route that stayed `○ 5m 1h` while blocker 1 correctly reclassified every
    // other route to `ƒ`, which means a fleet build that happens to run during
    // an Atlas episode BAKES AN EMPTY SITEMAP into the deployment and serves
    // it until the next build. Nothing expires it, because there is nothing
    // wrong with it from the cache's point of view: it is a successful render
    // of a legitimately-empty list.
    //
    // Scoped to THIS branch only, deliberately. The `isDemoSite()` return
    // below is the identical `[]` for an entirely legitimate reason, and a
    // demo site's empty sitemap is correct, cacheable, and must stay
    // prerendered. Bailing there would drag every demo build dynamic for no
    // reason. The `[]` is overloaded; the bail is not.
    await bailOutOfCachingDegradedRender();
    return [];
  }

  // The SAME object getSiteData() returns its origin fields from, so the
  // sitemap can never resolve a different host from the canonical.
  const siteData = toOriginSource(raw);

  // Perf short-circuit only. A demo emits no sitemap, so skip the detail-item
  // collection fetches below entirely. The AUTHORITATIVE demo gate lives in
  // buildSiteMapForSite (src/lib/seo/siteMapPolicy.ts) where it is pinned by a
  // test; deleting this line changes nothing but the number of upstream reads.
  if (isDemoSite(siteData)) return [];

  // Two-axis detail-route design, Phase 3 (§7.1/T4) — resolve detail-item URL
  // segments for pages that opted into `detailPage.sitemap === true`. Narrowed
  // to pages with an explicit `itemCollectionId` (rather than replaying the
  // full per-format primary-binding resolution `getPageCollectionId` needs,
  // which requires a SECOND `getSiteData()`-shaped fetch this lightweight
  // `siteDetails` read doesn't have) — every scoped detail-route page this
  // arc produces authors `itemCollectionId` explicitly, so this covers the
  // real feature without doubling upstream calls. Absent/false `sitemap` on
  // every page (the fleet default) ⇒ zero extra fetches.
  const sitemapPages = (raw.pages ?? []).filter(
    (p) => p?.detailPage?.sitemap === true && !!p.detailPage.itemCollectionId,
  );
  const detailItemSegmentsByPage: Record<string, string[]> = {};
  if (sitemapPages.length > 0) {
    await Promise.all(
      sitemapPages.map(async (page) => {
        const detailPage = page.detailPage!;
        const { items } = await getCollectionItems(detailPage.itemCollectionId!, { limit: 100 });
        const scoped = applyScope(items, detailPage.scope);
        const slug = (page.slug as string).replace(/^\/+/, '');
        detailItemSegmentsByPage[slug] = scoped.map((it) => itemSegment(it, detailPage.itemKeyField));
      }),
    );
  }

  // Build from the AUTHORITATIVE top-level page list (raw.pages — what getSiteData
  // uses), not siteDetails.values.pages (which the migrator never populates, so
  // the sitemap was homepage-only). See src/lib/seo/sitemap.ts.
  return buildSiteMapForSite(
    siteData,
    raw.pages,
    sitemapPages.length > 0 ? detailItemSegmentsByPage : undefined,
  );
};
