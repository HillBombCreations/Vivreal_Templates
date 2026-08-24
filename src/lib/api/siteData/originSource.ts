import type { SiteData } from '@/types/SiteData';

/**
 * The raw VR_Client_API `/tenant/siteDetails` shape, narrowed to the parts that
 * decide a site's public origin. Structurally satisfied by the full
 * `SiteDetailsResponse` in `./index.tsx`.
 */
export interface SiteDetailsOriginSource {
  siteDetails: { values: SiteData };
  domainName?: string;
  domainInformation?: { live_url?: string };
}

/**
 * The ONE construction of the object every origin decision is made from.
 *
 * `getSiteData()` spreads this as the head of its return value and
 * `getSiteMap()` calls it directly, so the canonical, the robots.txt
 * `Sitemap:` directive and every sitemap `<loc>` resolve from an object built
 * by the same expression, not by two literals that happen to agree.
 *
 * Why that matters concretely: `getSiteMap()` used to hand-build
 * `{ domainName: raw.domainName, domainInformation: raw.domainInformation }`.
 * It agreed with `getSiteData()` only because those were the only two fields
 * the resolver read. The moment a third field was added (`canonicalUrl`), a
 * change that widened only the resolver's type would typecheck, pass the whole
 * suite, and at cutover emit a canonical and a `Sitemap:` on
 * `https://vivreal.io` while all 29 `<loc>` entries stayed on
 * `https://next.vivreal.io`. A sitemap whose `<loc>` host differs from the
 * canonical is discarded wholesale by Google, which is the worst SEO state
 * available at a cutover (review-templates-106.md Trap 1). The spread below
 * makes that divergence structurally impossible: any new field arriving in
 * `siteDetails.values` reaches both readers, or neither.
 *
 * Ordering is load-bearing and matches what `getSiteData()` has always done:
 * spread `values` first, then let the top-level response fields win.
 * VR_Client_API returns those two outside the `siteDetails` envelope and the
 * top-level copy is authoritative.
 */
export function toOriginSource(raw: SiteDetailsOriginSource): SiteData {
  return {
    ...raw.siteDetails.values,
    domainName: raw.domainName,
    // Thread domainInformation through so the resolver can use `live_url` (the
    // deployed origin, set on every site) for metadata/OG absolute URLs.
    // Without it, subdomain sites lacking NEXT_PUBLIC_SITE_URL fell back to
    // localhost via the default metadataBase.
    domainInformation: raw.domainInformation,
  };
}
