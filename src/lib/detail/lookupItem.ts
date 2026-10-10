import 'server-only';
import { applyScope } from '@hillbombcreations/site-renderer';
import { getAllCollectionItems, getCollectionItems } from '@/lib/api/collections';
import { getPageCollectionId } from '@/lib/api/siteData';
import { resolveItem } from './resolveItem';
import { linkedItemScopes, restrictToLinked } from './linkedItems';
import type { PageConfig, SiteData } from '@/types/SiteData';

type PoolItem = Awaited<ReturnType<typeof getCollectionItems>>['items'][number];

export interface DetailItemLookup {
  /** The collection the page's detail route addresses. */
  collectionId: string;
  /** Everything in that collection, BEFORE `detailPage.scope` narrowed it. */
  unscopedItems: PoolItem[];
  /** The addressable item, or undefined when `itemId` matches nothing in scope. */
  item: PoolItem | undefined;
  /**
   * Whether the pool read actually happened. See `@/lib/api/degradedRead`.
   *
   * An `item` of `undefined` has two completely different causes that are
   * identical in the value: the id addresses nothing, or the collection could
   * not be read at all. The detail route turns the first into a 404, so it has
   * to be able to tell them apart (`@/lib/detail/itemMiss`). The OG card route
   * deliberately ignores this and falls back to the page's own card either way:
   * a social card must never be the thing that 404s a shared link.
   */
  degraded: boolean;
  /**
   * H177 - the inline rich-text image map for the pool this item came from.
   * The detail route merges it with the shell's and mounts the resolver, so a
   * blog post or article body renders its inline images instead of dropping
   * them. `{}` on any path that read nothing.
   */
  richTextImageUrls: Record<string, string>;
}

/**
 * Resolve ONE addressable detail item for a page, exactly the way
 * `[slug]/[itemId]/page.tsx`'s collection arm does.
 *
 * This exists as a shared function rather than as three copies because the
 * per-item OG card (`/og/[slug]/[itemId]`) and the detail page MUST resolve the
 * SAME item for the same URL. If they drift, the failure is silent and awful:
 * a correct page under a social card showing a different recipe. One function
 * makes that impossible rather than merely unlikely.
 *
 * Returns `null` when the page addresses no collection at all (a misconfigured
 * page, not a missing item) so callers can tell the two apart — the detail
 * route redirects-or-404s on the first and the OG route falls back to the page
 * card.
 *
 * Lookup semantics are `resolveItem`'s: `_id` first unconditionally, then
 * `raw[itemKeyField]` when the page configures one.
 */
export async function lookupDetailItem(
  siteData: SiteData,
  pageConfig: PageConfig,
  itemId: string,
): Promise<DetailItemLookup | null> {
  const detailPage = pageConfig.detailPage;
  const collectionId =
    detailPage?.itemCollectionId || getPageCollectionId(siteData, pageConfig.name, '');
  if (!collectionId) return null;

  // limit 100 mirrors the grid's own fetch (buildPageContext.ts) — the Client
  // API 502s on larger limits, and the list view already caps at 100.
  // Every item, not the first 100 (v5 search R4): the page list names every
  // item, so every item's address must resolve.
  const { items: unscopedItems, degraded, richTextImageUrls } = await getAllCollectionItems(collectionId);

  // `scope` restricts WHICH ITEMS ARE ADDRESSABLE here. Absent/malformed scope
  // ⇒ identity (applyScope's own contract), so an unscoped page is
  // byte-identical to before.
  //
  // And only the items some link on the site reaches (review of #190, B1): a
  // category list that opts out with `detailEligible: false`, or is scoped to
  // one section, does not make every item of the collection an address of
  // its own. Such an item answers 404 (the doorway guard below the caller),
  // never a second canonical for an item that lives elsewhere. Pages with no
  // block drawing the collection are unrestricted. See `./linkedItems.ts`;
  // the page list applies the same rule, so the two cannot disagree.
  const pages = [...(siteData.pageConfigs ?? []), ...(siteData.homePageConfig ? [siteData.homePageConfig] : [])];
  const scopedItems = restrictToLinked(
    applyScope(unscopedItems, detailPage?.scope),
    linkedItemScopes(pageConfig, pages, collectionId),
    applyScope,
  );

  return {
    collectionId,
    unscopedItems,
    item: resolveItem(scopedItems, itemId, detailPage?.itemKeyField),
    degraded,
    richTextImageUrls,
  };
}
