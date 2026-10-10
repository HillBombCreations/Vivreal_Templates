import type { MetadataRoute } from 'next';
import type { PageConfig } from '@/types/SiteData';
// Explicit .ts extension (not the `@/` alias): imported directly by
// sitemap.test.ts / originConsistency.test.ts under
// `node --experimental-strip-types --test`, which has no tsconfig `paths`
// resolution. Same convention robotsPolicy.ts / siteMapPolicy.ts follow.
import { isAuthorHiddenPage, pageIndexingBlock } from './pageIndexing.ts';
import { isPageTurnedOff } from '../pages/pageEnabled.ts';

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
 * to `/<slug>` with a descending priority. Four exclusions, each for its own
 * reason (they are kept as separate conditions rather than folded into one list
 * precisely because the reasons differ):
 *   - the home DUPLICATE. Home is in the sitemap, as the root entry, so a
 *     second `/home` entry would be a self-duplicate.
 *   - a page the owner turned OFF (`isPageTurnedOff`). Not a search rule at
 *     all, which is why it is a condition here rather than a
 *     `pageIndexingBlock` cause: the page does not SERVE. The routes answer
 *     `notFound()` for it off the same predicate, so submitting the URL would
 *     be advertising a 404 to every crawler that reads the file, and it would
 *     do it at the exact moment the owner thought they had taken the page
 *     down. Detail items under that page go with it, because the loop at the
 *     bottom walks this same filtered list.
 *   - the synthetic `subscribers` carrier page. VR_Client_API adds it as a data
 *     carrier for the EmailPopup and Templates `notFound()`s the route, so
 *     listing it would submit a 404.
 *   - anything `pageIndexingBlock` withholds from search. That covers BOTH
 *     indexability rules from the one owner, so this sitemap can never disagree
 *     with the `robots` meta tag the same page serves:
 *       · `'format'`: the NON-INDEXABLE page types (today the two Stripe
 *         checkout result pages). `dougs-kitchen.com` was advertising
 *         `/checkoutsuccess` and `/checkoutcancel` to crawlers: thin, duplicate,
 *         post-transaction pages with no search intent, which every OTHER
 *         surface in the platform already treats as system pages.
 *       · `'author'`: a human turned this page's Studio search-visibility
 *         toggle off (`seo.noindex`). Until this condition existed the sitemap
 *         ignored that flag entirely, so an author-hidden page was SUBMITTED to
 *         Google while simultaneously serving `noindex` to it: the documented
 *         Search Console error "Submitted URL marked noindex", and the same
 *         defect class as the checkout pages one line up.
 *     See ./pageIndexing.ts for the format list's membership rationale, for the
 *     candidates NOT excluded, and for why the author rule reads truthiness.
 *
 * Removing entries renumbers `priority` for the entries after them, because
 * priority is derived from position (`1.0 - (idx+1) * (0.9/n)`). That is an
 * arithmetic consequence of the removal rather than a separate change, and
 * priority is a non-binding hint Google has publicly said it ignores. It applies
 * to the author rule exactly as it did to the format rule.
 *
 * A site with no author-hidden page and no checkout page gets byte-identical
 * output to before either rule existed: both conditions are pure additions to
 * the filter, and the root entry's own gate below reads a field the fleet does
 * not set (the portal persists `seo.noindex` only when a human sets it to true).
 *
 * `siteOrigin` is a PRE-RESOLVED absolute origin (protocol + host, no trailing
 * slash). The caller resolves it through the one shared chain
 * (`resolveSiteOrigin(siteData, { surface: 'durable' })`, via
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
/** One detail item for the page list: its address segment and, when the record has one, its last change. */
export interface SitemapItem {
  segment: string;
  lastModified?: string;
}

/**
 * A recorded last-changed time, or `undefined`. R4: the page list claims a
 * date only when the record has one. It used to stamp `new Date()` on every
 * entry at every regeneration, so every URL on every site claimed it changed
 * every five minutes, and search engines learn to ignore a date like that.
 */
export function sitemapDate(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

const asItem = (item: string | SitemapItem): SitemapItem => (typeof item === 'string' ? { segment: item } : item);

export function buildSitemapEntries(
  pages:
    | Pick<PageConfig, 'slug' | 'format' | 'detailPage' | 'seo' | 'enabled' | 'updatedAt'>[]
    | undefined,
  siteOrigin: string,
  detailItemsByPage?: Record<string, ReadonlyArray<string | SitemapItem>>,
  { siteUpdatedAt }: { siteUpdatedAt?: string | null } = {},
): MetadataRoute.Sitemap {
  if (!siteOrigin) return [];
  const origin = siteOrigin.replace(/\/+$/, '');

  const allPages = pages ?? [];
  const siteDate = sitemapDate(siteUpdatedAt);
  const dated = (date: string | undefined) => (date ? { lastModified: date } : {});

  const eligiblePages = allPages.filter(
    (p) =>
      p &&
      typeof p.slug === 'string' &&
      p.slug &&
      p.slug !== 'home' &&
      p.format !== 'home' &&
      p.format !== 'subscribers' &&
      !isPageTurnedOff(p) &&
      pageIndexingBlock(p) === null,
  );
  const slugs = [...new Set(eligiblePages.map((p) => (p.slug as string).replace(/^\/+/, '')).filter(Boolean))];
  const pageBySlug = new Map(eligiblePages.map((p) => [(p.slug as string).replace(/^\/+/, ''), p]));

  const homePage = allPages.find((p) => p && (p.format === 'home' || p.slug === 'home'));

  const entries: MetadataRoute.Sitemap = [];
  if (!isAuthorHiddenPage(homePage)) {
    entries.push({
      url: origin,
      ...dated(sitemapDate(homePage?.updatedAt) ?? siteDate),
      changeFrequency: 'monthly',
      priority: 1.0,
    });
  }
  slugs.forEach((slug, idx) => {
    const priority = Math.max(0.1, 1.0 - (idx + 1) * (0.9 / slugs.length));
    entries.push({
      url: `${origin}/${slug}`,
      ...dated(sitemapDate(pageBySlug.get(slug)?.updatedAt) ?? siteDate),
      changeFrequency: 'monthly',
      priority: Number(priority.toFixed(2)),
    });
  });

  // R4: detail items are listed BY DEFAULT for every eligible page the caller
  // resolved items for (getSiteMap resolves them for every page with a detail
  // route, through the same reader the route uses). The owner's
  // `detailPage.sitemap: false` is the one opt-out; it used to be an opt-in.
  if (detailItemsByPage) {
    const seen = new Set<string>();
    for (const page of eligiblePages) {
      if (page.detailPage?.sitemap === false) continue;
      const slug = (page.slug as string).replace(/^\/+/, '');
      if (seen.has(slug)) continue;
      seen.add(slug);
      for (const item of detailItemsByPage[slug] ?? []) {
        const { segment, lastModified } = asItem(item);
        if (!segment) continue;
        entries.push({
          url: `${origin}/${slug}/${segment}`,
          ...dated(sitemapDate(lastModified)),
          changeFrequency: 'monthly',
          priority: 0.5,
        });
      }
    }
  }

  return entries;
}
