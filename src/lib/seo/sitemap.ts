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
 * sitemap). Empty `domainName` ⇒ `[]`.
 */
export function buildSitemapEntries(
  pages: Pick<PageConfig, 'slug' | 'format'>[] | undefined,
  domainName: string,
): MetadataRoute.Sitemap {
  if (!domainName) return [];

  const slugs = [
    ...new Set(
      (pages ?? [])
        .filter(
          (p) =>
            p &&
            typeof p.slug === 'string' &&
            p.slug &&
            p.slug !== 'home' &&
            p.format !== 'home' &&
            p.format !== 'subscribers',
        )
        .map((p) => (p.slug as string).replace(/^\/+/, ''))
        .filter(Boolean),
    ),
  ];

  const entries: MetadataRoute.Sitemap = [
    { url: `https://${domainName}`, lastModified: new Date(), changeFrequency: 'monthly', priority: 1.0 },
  ];
  slugs.forEach((slug, idx) => {
    const priority = Math.max(0.1, 1.0 - (idx + 1) * (0.9 / slugs.length));
    entries.push({
      url: `https://${domainName}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: Number(priority.toFixed(2)),
    });
  });
  return entries;
}
