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
 * ONLY THE ITEMS THE SITE LINKS (review of #190, B1). A `collection` source
 * carries `linkScopes` when links reach only some items (a list that opts out
 * with `detailEligible: false`, or a scoped one); none reach any item ⇒ no
 * source at all. See `../detail/linkedItems.ts`. The detail route narrows by
 * the same rule, so an address left out here is a 404 there.
 *
 * Pure, so it runs under `node --test`. The caller supplies the payments
 * provider (it comes from the server-only binding collector) and does the
 * reads.
 */
import type { PageConfig } from '@/types/SiteData';
import { servesCollectionDetail } from '../detail/detailFormats.ts';
import { pageDetailCollectionId } from '../detail/detailCollection.ts';
import { storefrontItemSources } from '../detail/storefrontSources.ts';
import { linkedItemScopes, type LinkPage } from '../detail/linkedItems.ts';

export interface CollectionSource {
  kind: 'collection';
  collectionId: string;
  itemKeyField?: string;
  scope?: NonNullable<PageConfig['detailPage']>['scope'];
  /** Absent: every item is linked. Present: only items inside one of these binding scopes. */
  linkScopes?: readonly unknown[];
}

export type SitemapDetailSource =
  | { kind: 'shows'; collectionId: string | undefined }
  | { kind: 'team'; collectionId: string | undefined }
  | { kind: 'products'; provider: string; collection: CollectionSource | null }
  | CollectionSource;

type SourcePage = Pick<PageConfig, 'slug' | 'format' | 'detailPage' | 'blocks' | 'collectionId' | 'collections'>;

function collectionSource(page: SourcePage, pages: readonly LinkPage[]): CollectionSource | null {
  const collectionId = page.detailPage?.itemCollectionId || pageDetailCollectionId(page);
  if (!collectionId) return null;
  const linkScopes = linkedItemScopes(page, pages, collectionId);
  if (linkScopes?.length === 0) return null;
  return {
    kind: 'collection',
    collectionId,
    ...(page.detailPage?.itemKeyField ? { itemKeyField: page.detailPage.itemKeyField } : {}),
    ...(page.detailPage?.scope ? { scope: page.detailPage.scope } : {}),
    ...(linkScopes ? { linkScopes } : {}),
  };
}

/** `pages` is every page of the site, home included: a widget elsewhere can link into this page. */
export function sitemapDetailSource(
  page: SourcePage,
  { paymentsProvider, pages }: { paymentsProvider: string | undefined; pages: readonly LinkPage[] },
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
      collection: sources.includes('collection') ? collectionSource(page, pages) : null,
    };
  }

  if (servesCollectionDetail(page)) return collectionSource(page, pages);

  // The pre-v5 opt-in, kept for the formats the default does not reach (a menu).
  if (detail?.sitemap === true && detail.itemCollectionId) return collectionSource(page, pages);

  return null;
}
