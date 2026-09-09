import 'server-only';

import type { ContentItem } from '@hillbombcreations/site-renderer';
import { getProductsRead } from '@/lib/api/products';
import { getSafeFieldValue } from '@/lib/utils/variantUtils';

/**
 * Server-side `Product[]` → renderer `ContentItem[]` bridge for the products
 * page-template.
 *
 * Why a dedicated bridge (not the plain `getIntegrationItems`):
 *  - `getProducts` returns the richer `Product` shape (resolved `gallery`,
 *    variant maps, `default_price`, `stock`, …). The renderer's `ProductsPage`
 *    reads variant data straight off `item.raw`, so the WHOLE product must go
 *    into `raw`; the top-level scalars are the default-variant values.
 *  - Routing products through `getIntegrationItems` would drop the gallery /
 *    variant resolution that cards + detail rely on.
 *
 * This is the exact `Product → ContentItem` map the live `ProductsPageClient`
 * already applies (`ProductsPageClient/index.tsx:59-72`), hoisted server-side
 * so VR_Client_API performs the filter/sort/search that powers the controlled
 * query. The `siteLogo` fallback for `imageUrl` is intentionally NOT applied
 * here — the server builder has no `siteData`; the renderer card falls back to
 * `siteData.logo` at render time.
 */
export async function getProductsAsContentItems(opts: {
  integrationType: string;
  filters?: Record<string, string>;
  search?: string;
  sort?: string;
}): Promise<{ items: ContentItem[]; degraded: boolean }> {
  // `getProductsRead`, not `getProducts`: the only consumer of this bridge is
  // `buildPageContext`, whose emptiness verdict can end in a 404. An empty
  // catalogue and a catalogue that could not be read are the same array here,
  // so the flag has to travel with the items or the verdict is drawn from an
  // absence. See ../degradedRead.ts.
  const { products, degraded } = await getProductsRead({
    integrationType: opts.integrationType,
    filters: opts.filters,
    searchVal: opts.search,
    sortVal: opts.sort,
  });

  const items = products.map((product) => {
    const defaultVariant = product.usingVariant?.values?.[0] ?? null;
    return {
      id: String(product._id ?? ''),
      title: getSafeFieldValue(product, 'name', defaultVariant) ?? '',
      description: getSafeFieldValue(product, 'description', defaultVariant) ?? '',
      imageUrl: getSafeFieldValue(product, 'imageUrl', defaultVariant) || undefined,
      imageSrcSet: getSafeFieldValue(product, 'imageSrcSet', defaultVariant) || undefined,
      price: getSafeFieldValue(product, 'price', defaultVariant) ?? undefined,
      source: 'integration' as const,
      integrationType: opts.integrationType,
      raw: product as unknown as Record<string, unknown>,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    };
  });

  return { items, degraded };
}
