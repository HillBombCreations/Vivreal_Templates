/**
 * Where a page's detail items come from, for the page list (v5 search R4:
 * "detail items by default for every page with a detail route").
 *
 * THE RULE: the page list names an item only through the SAME reader the
 * detail route resolves that item with, so every address it lists answers
 * 200. Each kind below mirrors one arm of `src/app/[slug]/[itemId]/page.tsx`:
 *   - `shows` and `team`: their own arms (`getShowsRead`,
 *     `getTeamMembersRead`), item address = the record id.
 *   - `products`: the storefront arm, provider products first (by id), then
 *     the page's collection when it also serves collection detail
 *     (`storefrontItemSources`).
 *   - `collection`: the generic arm (`servesCollectionDetail`), items from
 *     `detailPage.itemCollectionId` or the page's bound collection, scoped,
 *     addressed by `itemKeyField`.
 * `menu` pages are NOT listed by default: their arm resolves across several
 * bound lists (items, categories, siblings) and a menu's dishes are not the
 * pages people search for. A menu page that opted in with
 * `detailPage.sitemap: true` and an `itemCollectionId` is still listed.
 *
 * The owner's `detailPage.sitemap: false` and a switched-off detail route
 * (`detailPage.enabled: false`) list nothing.
 *
 * Pure, so it runs under `node --test`. The caller supplies the payments
 * provider (it comes from the server-only binding collector) and does the
 * reads.
 */
import type { PageConfig } from '@/types/SiteData';
import { servesCollectionDetail } from '../detail/detailFormats.ts';
import { pageDetailCollectionId } from '../detail/detailCollection.ts';
import { storefrontItemSources } from '../detail/storefrontSources.ts';

export interface CollectionSource {
  kind: 'collection';
  collectionId: string;
  itemKeyField?: string;
  scope?: NonNullable<PageConfig['detailPage']>['scope'];
}

export type SitemapDetailSource =
  | { kind: 'shows'; collectionId: string | undefined }
  | { kind: 'team'; collectionId: string | undefined }
  | { kind: 'products'; provider: string; collection: CollectionSource | null }
  | CollectionSource;

type SourcePage = Pick<PageConfig, 'format' | 'detailPage' | 'blocks' | 'collectionId' | 'collections'>;

function collectionSource(page: SourcePage): CollectionSource | null {
  const collectionId = page.detailPage?.itemCollectionId || pageDetailCollectionId(page);
  if (!collectionId) return null;
  return {
    kind: 'collection',
    collectionId,
    ...(page.detailPage?.itemKeyField ? { itemKeyField: page.detailPage.itemKeyField } : {}),
    ...(page.detailPage?.scope ? { scope: page.detailPage.scope } : {}),
  };
}

export function sitemapDetailSource(
  page: SourcePage,
  { paymentsProvider }: { paymentsProvider: string | undefined },
): SitemapDetailSource | null {
  const detail = page.detailPage;
  if (detail?.sitemap === false || detail?.enabled === false) return null;

  if (page.format === 'shows') return { kind: 'shows', collectionId: pageDetailCollectionId(page) };
  if (page.format === 'team') return { kind: 'team', collectionId: pageDetailCollectionId(page) };

  const sources = storefrontItemSources(page, paymentsProvider);
  if (sources.includes('provider')) {
    return {
      kind: 'products',
      // The detail route reads `paymentsProvider ?? 'stripe'`; the list reads the same.
      provider: paymentsProvider ?? 'stripe',
      collection: sources.includes('collection') ? collectionSource(page) : null,
    };
  }

  if (servesCollectionDetail(page)) return collectionSource(page);

  // The pre-v5 opt-in, kept for the formats the default does not reach (a menu).
  if (detail?.sitemap === true && detail.itemCollectionId) return collectionSource(page);

  return null;
}
