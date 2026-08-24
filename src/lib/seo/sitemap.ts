import type { MetadataRoute } from 'next';
import type { PageConfig } from '@/types/SiteData';

/**
 * Build sitemap entries from the site's REAL page configs.
 *
 * getSiteMap previously read `siteDetails.values.pages`, which the migrator never
 * populates (it persists pages at the site doc's top-level `pages`, surfaced by
 * VR_Client_API getSiteDetails as `raw.pages` — the same list getSiteData treats
 * as authoritative). So the live sitemap was homepage-only. This builds it from
 * that authoritative page list instead.
 *
 * The home page is the root entry (priority 1.0); each navigable content page maps
 * to `/<slug>` with a descending priority. Excluded: the home duplicate and the
 * synthetic `subscribers` carrier page (VR_Client_API adds it as a data carrier
 * for the EmailPopup; Templates notFound()s the route, so it must not be in the
 * sitemap).
 *
 * `siteOrigin` is a PRE-RESOLVED absolute origin (protocol + host, no trailing
 * slash). The caller resolves it through the one shared chain
 * (`resolveSiteOrigin(siteData, { prefer: 'durable' })`, via
 * `buildSiteMapForSite`) so this function stays pure and origin-source-
 * agnostic, and so a subdomain-only site (no `domainName`, the fleet majority)
 * stops emitting an empty sitemap. Empty `siteOrigin` ⇒ `[]`.
 *
 * Two-axis detail-route design, Phase 3 (§7.1/T4) — `detailItemSegmentsByPage`
 * is a pre-resolved map of `pageSlug -> [urlSegment, ...]` for pages with
 * `detailPage.sitemap === true` (the caller does the async fetch/scope/
 * itemSegment work — this function stays pure/synchronous so its existing
 * unit tests keep working unchanged). Absent/empty for a page ⇒ zero detail
 * items added for it — byte-identical to today's output when the map is
 * omitted entirely.
 */
export function buildSitemapEntries(
  pages: Pick<PageConfig, 'slug' | 'format' | 'detailPage'>[] | undefined,
  siteOrigin: string,
  detailItemSegmentsByPage?: Record<string, string[]>,
): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  const origin = siteOrigin.replace(/\/+$/, '');

  const eligiblePages = (pages ?? []).filter(
    (p) =>
      p &&
      typeof p.slug === 'string' &&
      p.slug &&
      p.slug !== 'home' &&
      p.format !== 'home' &&
      p.format !== 'subscribers',
  );
  const slugs = [...new Set(eligiblePages.map((p) => (p.slug as string).replace(/^\/+/, '')).filter(Boolean))];

  const entries: MetadataRoute.Sitemap = [
    { url: origin, lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
  ];
  slugs.forEach((slug, idx) => {
    const priority = Math.max(0.1, 1.0 - (idx + 1) * (0.9 / slugs.length));
    entries.push({
      url: `${origin}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: Number(priority.toFixed(2)),
    });
  });

  // Detail items — only for pages that opted in (`detailPage.sitemap === true`)
  // AND have resolved segments handed in. A page without `detailItemSegmentsByPage`
  // at all (the fleet default: the param itself is omitted) adds nothing here,
  // so `buildSitemapEntries(pages, origin)` (the 2-arg call every existing
  // caller/test makes) is byte-identical output.
  if (detailItemSegmentsByPage) {
    for (const page of eligiblePages) {
      if (page.detailPage?.sitemap !== true) continue;
      const slug = (page.slug as string).replace(/^\/+/, '');
      const segments = detailItemSegmentsByPage[slug];
      if (!segments || segments.length === 0) continue;
      for (const segment of segments) {
        entries.push({
          url: `${origin}/${slug}/${segment}`,
          lastModified: new Date(),
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}
