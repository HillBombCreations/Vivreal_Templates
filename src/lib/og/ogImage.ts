import 'server-only';
import type { SiteData } from '@/types/SiteData';

/**
 * Resolve the site's canonical origin (protocol + host, no trailing slash).
 *
 * Prefers `NEXT_PUBLIC_SITE_URL` — the per-site canonical URL set in each
 * Amplify app's env. Behind CloudFront the incoming `Host` header is rewritten,
 * so request-derived origins (`req.nextUrl.origin`) are unreliable; the env var
 * is the repo convention for the canonical origin (see robots/sitemap, which use
 * the same site domain). Falls back to the API-provided `domainName` so a site
 * still emits absolute URLs even if the env var is unset, and returns '' when
 * neither is known (callers then emit path-relative URLs, resolved by
 * `metadataBase`).
 */
export function resolveSiteOrigin(
  siteData?: Pick<SiteData, 'domainName'> | null,
): string {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const domain = siteData?.domainName?.trim();
  return domain ? `https://${domain.replace(/\/+$/, '')}` : '';
}

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
