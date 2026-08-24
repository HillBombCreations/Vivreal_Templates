import type { MetadataRoute } from 'next';
import type { PageConfig, SiteData } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): imported directly by
// demoSafety.test.ts / originConsistency.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution.
import { isDemoSite } from './demoSafety.ts';
import { buildSitemapEntries } from './sitemap.ts';
import { resolveSiteOrigin } from '../og/siteOrigin.ts';

type SiteMapSiteData = Pick<
  SiteData,
  'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'
>;

/**
 * Compose the site's sitemap from an already-fetched `siteData` plus its page
 * list.
 *
 * Lives here rather than inline in `getSiteMap()` for the same reason
 * `buildRobotsPolicy` does: `src/lib/api/siteData/index.tsx` is `server-only`
 * AND `.tsx`, so the plain-Node test runner cannot import it, and mutation
 * testing proved the demo gate could be deleted with the whole suite still
 * green (review-templates-106.md B2). This function is the ONE place that gate
 * lives, so a test can call the real thing.
 *
 * It is also the ONE place the sitemap's origin is resolved, through the same
 * `resolveSiteOrigin` chain that produces the page canonical. Before this,
 * `getSiteMap()` hand-built its own resolver input and could silently resolve a
 * DIFFERENT host from the canonical and the robots.txt `Sitemap:` directive.
 * A sitemap whose `<loc>` host differs from the canonical is discarded wholesale
 * by Google (review-templates-106.md Trap 1).
 */
export function buildSiteMapForSite(
  siteData: SiteMapSiteData,
  pages: Pick<PageConfig, 'slug' | 'format' | 'detailPage'>[] | undefined,
  detailItemSegmentsByPage?: Record<string, string[]>,
): MetadataRoute.Sitemap {
  // SEO demo-safety: emit NO sitemap for a pre-cutover demo. A sitemap actively
  // invites indexing of a near-duplicate of the prospect's real site. Cutover
  // flips lifecycleState to 'live' and the full sitemap returns.
  if (isDemoSite(siteData)) return [];

  // `durable`: sitemap `<loc>` values sit in crawler caches for days, so an
  // Amplify build host is refused rather than published.
  return buildSitemapEntries(
    pages,
    resolveSiteOrigin(siteData, { surface: 'durable' }),
    detailItemSegmentsByPage,
  );
}
