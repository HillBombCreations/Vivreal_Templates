import type { SiteData } from '@/types/SiteData';

/**
 * SEO demo-safety gate.
 *
 * A migrated **demo** site (a pre-cutover outreach deployment on
 * `<name>.vivreal.io`) is a near-duplicate of the prospect's real website. If a
 * search engine indexes it, we create live duplicate-content exposure against
 * the very prospect we're courting. So a demo must be withheld from every index
 * (`noindex` + `robots.txt Disallow: /` + no sitemap) and point its canonical at
 * the prospect's real URL; at cutover the site flips to `live` and becomes
 * fully indexable with its own sitemap + redirects.
 *
 * Signal precedence:
 *   1. `siteData.lifecycleState` — the site doc's flag (flips at cutover with a
 *      revalidate, no rebuild). The primary mechanism.
 *   2. `process.env.SITE_LIFECYCLE` — a build-time fallback so a demo can be
 *      protected even before the flag is written to the doc.
 *
 * **Fail-safe default:** absent on BOTH ⇒ NOT a demo ⇒ fully indexable. That is
 * deliberate — it guarantees no existing live customer site is ever accidentally
 * deindexed by this gate. Only an explicit `'demo'` opts a site out of indexing.
 */
export const isDemoSite = (
  siteData?: Pick<SiteData, 'lifecycleState'> | null,
): boolean => (siteData?.lifecycleState ?? process.env.SITE_LIFECYCLE) === 'demo';

/**
 * The prospect's original URL for a demo site's `<link rel="canonical">`, from
 * the site doc's `sourceUrl` (carried from the migration source) or the
 * `SITE_SOURCE_URL` env fallback. Returns `''` when unknown — callers must skip
 * the canonical entirely in that case (the `noindex` still protects the
 * prospect). Only meaningful for a demo site; callers gate on {@link isDemoSite}.
 */
export const getDemoSourceUrl = (
  siteData?: Pick<SiteData, 'sourceUrl'> | null,
): string => siteData?.sourceUrl ?? process.env.SITE_SOURCE_URL ?? '';
