import 'server-only';
import type { MetadataRoute } from 'next';
import type {
  HomeSection,
  PageCollectionBinding,
  PageConfig,
  PageIntegrationBinding,
  SiteData,
} from '@/types/SiteData';
import { clientFetchCached, SITE_CACHE_TTL_SECONDS } from '@/lib/api/client';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { buildSitemapEntries } from '@/lib/seo/sitemap';
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

const FALLBACK_SITE_DATA: SiteData = {
  primary: '#000000',
  secondary: '#333333',
  hover: '#555555',
  surface: '#ffffff',
  'surface-alt': '#f5f5f5',
  'text-primary': '#000000',
  'text-secondary': '#666666',
  'text-inverse': '#ffffff',
  border: '#e0e0e0',
  pages: {},
  pageConfigs: [],
  siteMap: [],
  logo: {
    name: '',
    key: '',
    type: '',
    currentFile: { source: '' },
  },
};

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

  if (!raw?.siteDetails?.values) return FALLBACK_SITE_DATA;

  const allPages = raw.pages ?? [];
  const homePageConfig = allPages.find(
    (p) => p.format === "home" || p.slug === "home"
  );

  const pageConfigs = allPages.filter(
    (p) => p.format !== "home" && p.slug !== "home"
  );

  // Wire the renderer's Schedule "Subscribe" button. The renderer reads
  // page.labels.icalFeedUrl and rewrites https:// → webcal://, so it MUST be an
  // absolute https URL on the site's canonical domain (a relative URL would not
  // survive the webcal rewrite). The URL points at this site's own
  // /feeds/schedule.ics proxy route (same origin). Only inject when a schedule
  // page exists AND the canonical domain is known — never set a partial/relative
  // value the renderer would mangle. No renderer change, no per-site authoring.
  const domainName = raw.domainName;
  if (domainName) {
    for (const page of pageConfigs) {
      if (page.format === "schedule") {
        page.labels = {
          ...(page.labels ?? {}),
          icalFeedUrl: `https://${domainName}/feeds/schedule.ics`,
        };
      }
    }
  }

  return {
    ...raw.siteDetails.values,
    domainName: raw.domainName,
    // Thread domainInformation through so resolveSiteOrigin can use `live_url`
    // (the deployed origin, set on every site) for metadata/OG absolute URLs —
    // without it, subdomain sites lacking NEXT_PUBLIC_SITE_URL fell back to
    // localhost via the default metadataBase.
    domainInformation: raw.domainInformation,
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
 * SP-6 Task 1 (D-E, additive superset): resolution order:
 *   1. Page-template block binding (blocks-first, post-SP-3 backfill)
 *   2. Legacy page.collectionId (pre-SP-7 fallback)
 *   3. Legacy page.collections[0].collectionId (pre-SP-7 fallback)
 *   4. Env-var fallback (Comedy Collective / EastTenn SHOWS_ID / TEAMMEMBERS_ID)
 *
 * The block path picks the CONTENT binding — the first page-template block's
 * first binding that carries a collectionId (skips filter/secondary bindings).
 * Shows/team page-templates carry a single content binding; products uses a
 * different reader (env SITE_ID), so the single-binding assumption holds here.
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

  // 1. Block binding — read first page-template block's first content binding.
  const blockCollectionId = page.blocks
    ?.find((b) => b?.type?.kind === 'page-template')
    ?.config?.bindings
    ?.find((bd) => bd.collectionId)
    ?.collectionId;

  // Additive superset: block → legacy collectionId → legacy collections → env.
  return blockCollectionId || page.collectionId || page.collections?.[0]?.collectionId || envFallback;
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

  if (!raw) return [];

  // SEO demo-safety: emit NO sitemap for a pre-cutover demo — a sitemap actively
  // invites indexing of a near-duplicate of the prospect's real site. Cutover
  // flips lifecycleState to 'live' and the full sitemap returns. See
  // src/lib/seo/demoSafety.ts.
  if (isDemoSite(raw.siteDetails?.values)) return [];

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
  return buildSitemapEntries(
    raw.pages,
    raw.domainName ?? '',
    sitemapPages.length > 0 ? detailItemSegmentsByPage : undefined,
  );
};
