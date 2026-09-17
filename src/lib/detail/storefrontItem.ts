import 'server-only';
import { getProductByIdRead } from '@/lib/api/products';
import { collectBindingTargets } from '@/lib/api/composition/bindings';
import { isPaymentsProvider } from '@/lib/payments';
import { lookupDetailItem } from './lookupItem';
import { storefrontItemSources } from './storefrontSources';
import { offerFieldValue, offerVariantKey } from './productOffer';
import type { PageConfig, SiteData } from '@/types/SiteData';

/** What a product page's metadata and card need, from whichever source holds the item. */
export interface StorefrontItemSummary {
  title: string | undefined;
  description: string | undefined;
  imageUrl: string | undefined;
  raw: Record<string, unknown>;
}

/**
 * Storefront Phase 0.3: resolve one storefront item for `generateMetadata` and
 * `/og/[slug]/[itemId]`, in the SAME source order the page uses
 * (`storefrontItemSources`), so a page and its card cannot describe different
 * items. A failed read yields null, and both callers fall back to the page's
 * own title and card; neither is ever the thing that 404s a link.
 */
export async function resolveStorefrontItemSummary(
  siteData: SiteData,
  pageConfig: PageConfig,
  itemId: string,
): Promise<StorefrontItemSummary | null> {
  const { integrationTypes } = collectBindingTargets(pageConfig);
  const paymentsProvider = integrationTypes.find((type) => isPaymentsProvider(type));
  for (const source of storefrontItemSources(pageConfig, paymentsProvider)) {
    if (source === 'provider') {
      const { product } = await getProductByIdRead(itemId, paymentsProvider ?? 'stripe');
      if (!product) continue;
      const variantKey = offerVariantKey(product.usingVariant);
      const variantValues = product.usingVariant?.values;
      return {
        title: offerFieldValue(product.name, variantKey, variantValues),
        description: offerFieldValue(product.description, variantKey, variantValues),
        imageUrl: typeof product.imageUrl === 'string' ? product.imageUrl : undefined,
        raw: Object.fromEntries(Object.entries(product)),
      };
    }
    const lookup = await lookupDetailItem(siteData, pageConfig, itemId);
    if (lookup?.item) {
      return {
        title: lookup.item.title,
        description: lookup.item.description,
        imageUrl: lookup.item.imageUrl,
        raw: lookup.item.raw ?? {},
      };
    }
  }
  return null;
}
