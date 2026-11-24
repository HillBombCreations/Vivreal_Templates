import type { CoordinatedProductsProps, ProductsPageProps } from "@hillbombcreations/site-renderer";
import ProductsPageComposed from "@/components/PageTemplates/ProductsPageComposed";
import CoordinatedProductsComposed from "@/components/PageTemplates/CoordinatedProductsComposed";
import type { ProductQuery } from "@/lib/composition/productQuery";

/**
 * The live products-storefront component overrides for composePage, BOTH
 * topologies (monolith `ProductsPage` page-template + atomized
 * `group(coordinated:'products')`), each carrying `SiteRendererBridge` so the
 * renderer's storefront gets the real `CartAdapter` (add-to-cart / buy-now /
 * cart count) instead of the bare uncontrolled preview arm.
 *
 * Registered for EVERY composed format, not just `format:'products'`: an
 * override only fires when composePage actually renders that arm, and under
 * the universal page model a storefront group is composable on ANY page.
 * Format-gating these was the first-live-Square-E2E bug: the catalog-format
 * Shop page rendered its Square grid through the bare arm, so every Add was
 * a silent no-op (`ProductsProvider.handleAdd` guards on the CartAdapter).
 *
 * Shared by [slug]/page.tsx and [slug]/[itemId]/page.tsx (CP-11 nested
 * sub-pages) so the two routes cannot drift.
 *
 * F323 (release C): no `<Suspense>` box here, so the shop is sent complete to
 * readers that run no scripts. Each route passes the `ProductQuery` it already
 * parsed and filtered the items by, and the shop's controls are seeded from
 * it, so nothing in the shop reads the address. Two reasons, both measured:
 *   - React sends a finished box over 500 bytes in a hidden segment once the
 *     page passes 12,800 bytes, in a request render too, so a box around the
 *     storefront hid it from those readers on every shop page.
 *   - `useSearchParams()` throws in a server rebuild of a stored page, and with
 *     no box above it a stored page that gained a shop answered 500. Taking
 *     the query from the route removes that reader, and with it the box.
 * `pageBoundaries.test.ts` refuses a box or a `useSearchParams()` call here,
 * and refuses an import of either component anywhere else.
 *
 * No "use client" here: the wrappers are server functions closing over the
 * query, which works because the renderer draws an override as a plain element
 * on the server. The query is a plain object of strings, so it crosses to the
 * client components as an ordinary prop.
 */
export function liveProductsOverrides(query: ProductQuery) {
  return {
    ProductsPage: (p: ProductsPageProps) => <ProductsPageComposed {...p} query={query} />,
    CoordinatedProducts: (p: CoordinatedProductsProps) => <CoordinatedProductsComposed {...p} query={query} />,
  } as const;
}
