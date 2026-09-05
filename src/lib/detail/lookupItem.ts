import 'server-only';
import { applyScope } from '@hillbombcreations/site-renderer';
import { getCollectionItems } from '@/lib/api/collections';
import { getPageCollectionId } from '@/lib/api/siteData';
import { resolveItem } from './resolveItem';
import type { PageConfig, SiteData } from '@/types/SiteData';

type PoolItem = Awaited<ReturnType<typeof getCollectionItems>>['items'][number];

export interface DetailItemLookup {
  /** The collection the page's detail route addresses. */
  collectionId: string;
  /** Everything in that collection, BEFORE `detailPage.scope` narrowed it. */
  unscopedItems: PoolItem[];
  /** The addressable item, or undefined when `itemId` matches nothing in scope. */
  item: PoolItem | undefined;
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
  const { items: unscopedItems } = await getCollectionItems(collectionId, { limit: 100 });

  // `scope` restricts WHICH ITEMS ARE ADDRESSABLE here. Absent/malformed scope
  // ⇒ identity (applyScope's own contract), so an unscoped page is
  // byte-identical to before.
  const scopedItems = applyScope(unscopedItems, detailPage?.scope);

  return {
    collectionId,
    unscopedItems,
    item: resolveItem(scopedItems, itemId, detailPage?.itemKeyField),
  };
}
