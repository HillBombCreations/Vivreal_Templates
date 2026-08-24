import 'server-only';
export { resolveSiteOrigin, resolveCanonicalUrl, buildDetailUrl } from './siteOrigin';
export type { OriginPreference, OriginSiteData } from './siteOrigin';

/**
 * Build the Open Graph image URL for a page. Always points at the dynamic
 * `/og/[slug]` route (a stable, non-expiring URL crawlers can cache). That route
 * proxies the page's Studio-uploaded image (`labels.ogImage`) when present and
 * otherwise generates a branded card — so the emitted `og:image` never carries a
 * short-lived signed media URL.
 */
export function buildOgImageUrl(origin: string, slug: string): string {
  return `${origin}/og/${encodeURIComponent(slug)}`;
}
