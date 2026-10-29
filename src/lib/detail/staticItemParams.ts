/**
 * The item addresses `[slug]/[itemId]` prerenders at build (owner ideas
 * 2026-10-29, plan 3.8, T11). Pure, with every read injected, so `node --test`
 * decides the list the way the route does.
 *
 * WHY. With no `generateStaticParams`, Next 16.4.1 renders this route fully
 * dynamic whatever `revalidate` says, so every blog post and recipe was sent
 * `no-store` (measured up to 3.25 s). Listing the items lets each one prerender
 * with `revalidate = 300`, the home page's model.
 *
 * WHAT IS LISTED. For every top-level page that serves collection detail
 * (`servesCollectionDetail`, detail page not switched off, the page itself not
 * turned off), the first `PER_PAGE_LIMIT` items of its collection, read through
 * the same cached reader the build's fill pass already makes, each at the
 * address a visitor sees: `itemSegment(item, detailPage.itemKeyField)`, the
 * helper every list link is built with. Never the raw id when a key field is
 * set, because an id address answers a redirect, and a redirect at build
 * caches nothing. Capped at `TOTAL_LIMIT` across the site so a large catalog
 * cannot stretch every fleet build. Shows, team members and products are not
 * listed: their own readers, redirects and `headers()` reads keep them
 * dynamic, as today.
 *
 * THE SENTINEL. One extra pair whose render calls `connection()` and then
 * `notFound()` (see the route). It is what keeps the route correct whatever
 * the list holds:
 *  - the list is never empty (an empty list makes Next classify the route as
 *    static, and with the render gate off every URL then answers 500);
 *  - the route always has a path that bails at build, so the build writes NO
 *    `dynamicRoutes` fallback for it, and every address not in the list
 *    renders plain dynamic (200, `no-store`) as today, including the id
 *    redirects of shows and team members, instead of a 500 "changed from
 *    static to dynamic at runtime" (research 1.11).
 */

/** Never an owner page slug: the leading underscore is reserved (`_next`). */
export const DETAIL_SENTINEL = '_vr-static-sentinel';
export const DETAIL_SENTINEL_PARAMS = Object.freeze({ slug: DETAIL_SENTINEL, itemId: DETAIL_SENTINEL });

export const PER_PAGE_LIMIT = 100;
export const TOTAL_LIMIT = 300;

export function isDetailSentinel(slug: string, itemId: string): boolean {
  return slug === DETAIL_SENTINEL && itemId === DETAIL_SENTINEL;
}

export interface ListedPage {
  slug?: string;
  format?: string;
  enabled?: boolean;
  detailPage?: { enabled?: boolean; itemKeyField?: string } | null;
}

export interface ListedItem {
  id?: string;
  raw?: Record<string, unknown>;
}

export interface StaticItemDeps<P extends ListedPage> {
  servesCollectionDetail: (page: P) => boolean;
  isPageTurnedOff: (page: P) => boolean;
  collectionIdOf: (page: P) => string | undefined;
  /** The cached list read; resolves to `[]` on a failed read (never throws to here). */
  readItems: (collectionId: string) => Promise<readonly ListedItem[]>;
  segmentOf: (item: ListedItem, itemKeyField: string | undefined) => string;
  /** The renderer's `isReservedPageSlug`: a page under a fixed route is never listed (review B1). */
  isReservedSlug: (slug: string) => boolean;
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,199}$/;

export async function listStaticItemParams<P extends ListedPage>(
  pages: readonly P[],
  deps: StaticItemDeps<P>,
): Promise<Array<{ slug: string; itemId: string }>> {
  const params: Array<{ slug: string; itemId: string }> = [];
  const seen = new Set<string>();
  for (const page of pages) {
    if (params.length >= TOTAL_LIMIT) break;
    const slug = page?.slug;
    // A nested page slug (`features/ai-sites`) is not a [slug] segment.
    if (typeof slug !== 'string' || !slug || slug.includes('/') || slug === DETAIL_SENTINEL) continue;
    if (deps.isReservedSlug(slug)) continue;
    if (deps.isPageTurnedOff(page) || page.detailPage?.enabled === false) continue;
    if (!deps.servesCollectionDetail(page)) continue;
    const collectionId = deps.collectionIdOf(page);
    if (!collectionId) continue;
    let items: readonly ListedItem[];
    try {
      items = await deps.readItems(collectionId);
    } catch {
      continue; // a failed read lists nothing; those items stay dynamic, as today
    }
    for (const item of items.slice(0, PER_PAGE_LIMIT)) {
      if (params.length >= TOTAL_LIMIT) break;
      const itemId = deps.segmentOf(item, page.detailPage?.itemKeyField);
      // Only an address the router would hand back unchanged.
      if (!SEGMENT.test(itemId)) continue;
      const key = `${slug}/${itemId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      params.push({ slug, itemId });
    }
  }
  return params;
}
