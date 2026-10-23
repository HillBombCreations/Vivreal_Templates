/**
 * The collections whose items a storefront sells, which the floor must never
 * hold (owner decision 2, 2026-10-23: products and prices stay OUT of the
 * snapshot). vivreal-hq docs/bugs/site-first-read-fallback/plan.md, row 7.
 *
 * Provider products never reach the floor (their reads opt out and a payments
 * type is ineligible, `./eligibility.ts`). The case this module exists for is
 * the resale shop: a `products` page bound to a COLLECTION
 * (`../../detail/storefrontSources.ts`, D1), whose sellable items and prices
 * are read through `collectionObjects`, which the path alone cannot tell apart
 * from any other collection. So the build names those collection ids, drops
 * every key naming one from the merged snapshot, and the runtime refuses the
 * floor for any key naming one as a second guard.
 *
 * WHICH PAGES. A storefront page is one whose item sources include the
 * payments provider (`storefrontItemSources(...).includes('provider')`: a
 * `products` page, or any page bound to a payments provider). Of those, the
 * ones that also serve COLLECTION detail sell that collection, and its id is
 * excluded. A collection-list page that sells nothing (a blog, a menu) is not
 * a storefront and stays in the floor.
 *
 * THE IDS COME FROM THE BUILD'S SITE DATA. A collection bound to a storefront
 * after the build is not excluded until the next build; rebuild-after-save
 * bounds that window to minutes once it runs in `all` mode.
 *
 * Plain module (T14). The page's binding targets are passed in rather than
 * read here, because the reader that resolves legacy bindings
 * (`../composition/bindings.ts`) imports `server-only`.
 */
import { storefrontItemSources } from '../../detail/storefrontSources.ts';
import { pageDetailCollectionId, type DetailPageLike } from '../../detail/detailCollection.ts';
import { isPaymentsProvider } from '../../payments.ts';

export interface StorefrontPageLike extends DetailPageLike {
  format?: string;
  detailPage?: { itemCollectionId?: string } | null;
}

export function storefrontCollectionIds<P extends StorefrontPageLike>(
  pages: readonly P[],
  integrationTypesOf: (page: P) => readonly string[],
): string[] {
  const ids = new Set<string>();
  for (const page of pages) {
    if (!page) continue;
    const paymentsProvider = integrationTypesOf(page).find((type) => isPaymentsProvider(type));
    const sources = storefrontItemSources(page, paymentsProvider);
    if (!sources.includes('provider') || !sources.includes('collection')) continue;
    const id = page.detailPage?.itemCollectionId || pageDetailCollectionId(page);
    if (id) ids.add(id);
  }
  return [...ids];
}
