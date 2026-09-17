/**
 * Storefront Phase 0.1: the order a storefront item is looked for, shared by
 * the detail route, its metadata and the per-item social card, so the three
 * cannot land on different items for one URL (the `lookupItem.ts` rule, one
 * level up).
 *
 * D1: the resale shop is a `products` page bound to a collection. The route
 * read the payments provider first and answered 404 on a miss, so the
 * collection arm its `detailPage.itemCollectionId` would satisfy never ran.
 * A provider miss is now final only when no collection source follows.
 *
 * Pure, dependency-free apart from two sibling gates, so it runs under
 * `node --experimental-strip-types --test`.
 */

import { servesCollectionDetail } from './detailFormats.ts';
import { isPaymentsProvider } from '../payments.ts';

export type StorefrontItemSource = 'provider' | 'collection';

type SourcesPage = { format?: string; detailPage?: { itemCollectionId?: string } | null };

export function storefrontItemSources(
  page: SourcesPage,
  paymentsProvider: string | undefined,
): StorefrontItemSource[] {
  const sources: StorefrontItemSource[] = [];
  if (page.format === 'products' || isPaymentsProvider(paymentsProvider)) sources.push('provider');
  if (servesCollectionDetail(page)) sources.push('collection');
  return sources;
}

export function providerMissIsFinal(page: SourcesPage): boolean {
  return page.format === 'products' && !servesCollectionDetail(page);
}
