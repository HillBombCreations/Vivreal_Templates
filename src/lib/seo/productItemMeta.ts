/**
 * Storefront Phase 0.3 (D4): the title and description of one product page.
 *
 * Every product page used to share the shop page's title. A page-level
 * `seo.metaTitle` is authored for the SHOP, so it is not an input here; an
 * authored `detailPage.seo` pattern is, and it wins.
 *
 * Pure, no imports beyond a sibling, so it runs under plain `node --test`.
 */

import { plainMeta } from './plainMeta.ts';

export interface ProductItemMetaInput {
  itemTitle: string | undefined;
  itemDescription: unknown;
  siteName: string;
  patternTitle: string | undefined;
  patternDescription: string | undefined;
  pageSubtitle: unknown;
  pageName: string;
}

export function productItemMetaText(input: ProductItemMetaInput): { title: string; description: string } {
  const name = input.itemTitle?.trim() || input.pageName;
  const fallback = `${name} | ${input.siteName}`;
  return {
    title: input.patternTitle || fallback,
    description:
      input.patternDescription ||
      plainMeta(input.itemDescription, 160) ||
      plainMeta(input.pageSubtitle, 160) ||
      fallback,
  };
}
