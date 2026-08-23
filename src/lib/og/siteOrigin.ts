import type { SiteData } from '@/types/SiteData';
// Relative + explicit `.ts` extension (not the `@/` alias): this module is
// imported directly by ogImage.test.ts/routeMetadata.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution — same convention routeMetadata.ts already follows.
import { isDemoSite } from '../seo/demoSafety.ts';

type OriginSiteData = Pick<SiteData, 'canonicalUrl' | 'domainName' | 'domainInformation' | 'lifecycleState'>;

/**
 * `canonicalUrl` lands in public SEO tags and every absolute URL this module
 * builds (OG, JSON-LD, sitemap, iCal feed). A malformed or attacker-influenced
 * value there is a cross-domain canonical / open-redirect hazard (OWASP ASVS
 * 5.1 input validation) — require a genuine absolute https origin and fall
 * back to the existing resolution chain for anything else.
 */
function isAbsoluteHttpsOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.host.length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolve JUST the operator-authored `canonicalUrl` — demo-gated and
 * validated, with NO env/live_url/domainName fallback. `''` means "nothing
 * authored" (or a demo, or a malformed value), not "resolve me an origin
 * some other way."
 *
 * This is deliberately narrower than {@link resolveSiteOrigin}: callers that
 * decide whether to EMIT a `<link rel="canonical">` tag (routeMetadata.ts)
 * must default-absent when canonicalUrl itself is unset — every existing
 * fleet site has a domainName, so falling back to the general origin chain
 * here would synthesize a brand-new canonical tag on every page of every
 * site that never had one, which is exactly the fleet-wide regression this
 * field must not cause.
 */
export function resolveCanonicalUrl(siteData?: OriginSiteData | null): string {
  // SEO demo-safety: VR_Secure_API's cutover endpoint can persist canonicalUrl
  // BEFORE lifecycleState flips to 'live' (write-ahead so Stage 6 can confirm
  // it before the mutation). Never resolve it while the site is still a demo
  // — that would tell crawlers the demo IS the production apex. Same gate
  // that already governs noindex (see demoSafety.ts).
  if (isDemoSite(siteData)) return '';
  const persistedUrl = siteData?.canonicalUrl?.trim();
  if (!persistedUrl || !isAbsoluteHttpsOrigin(persistedUrl)) return '';
  return persistedUrl.replace(/\/+$/, '');
}

export function resolveSiteOrigin(
  siteData?: OriginSiteData | null,
): string {
  const persistedUrl = resolveCanonicalUrl(siteData);
  if (persistedUrl) return persistedUrl;
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  const liveUrl = siteData?.domainInformation?.live_url?.trim();
  if (liveUrl) return liveUrl.replace(/\/+$/, '');
  const domain = siteData?.domainName?.trim();
  return domain ? `https://${domain.replace(/\/+$/, '')}` : '';
}

export function buildDetailUrl(
  siteData: OriginSiteData,
  slug: string,
  itemId: string,
): string | undefined {
  const origin = resolveSiteOrigin(siteData);
  // Preserve the existing route serialization. Next.js supplies already-decoded
  // params here, and adding encoding would change schema bytes for existing sites.
  return origin ? `${origin}/${slug}/${itemId}` : undefined;
}
