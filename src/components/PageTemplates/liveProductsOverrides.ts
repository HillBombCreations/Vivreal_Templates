import ProductsPageComposed from "@/components/PageTemplates/ProductsPageComposed";
import CoordinatedProductsComposed from "@/components/PageTemplates/CoordinatedProductsComposed";

/**
 * The live products-storefront component overrides for composePage — BOTH
 * topologies (monolith `ProductsPage` page-template + atomized
 * `group(coordinated:'products')`), each carrying `SiteRendererBridge` so the
 * renderer's storefront gets the real `CartAdapter` (add-to-cart / buy-now /
 * cart count) instead of the bare uncontrolled preview arm.
 *
 * Registered for EVERY composed format, not just `format:'products'`: an
 * override only fires when composePage actually renders that arm, and under
 * the universal page model a storefront group is composable on ANY page.
 * Format-gating these was the first-live-Square-E2E bug — the catalog-format
 * Shop page rendered its Square grid through the bare arm, so every Add was
 * a silent no-op (`ProductsProvider.handleAdd` guards on the CartAdapter).
 *
 * Shared by [slug]/page.tsx and [slug]/[itemId]/page.tsx (CP-11 nested
 * sub-pages) so the two routes cannot drift.
 */
export const LIVE_PRODUCTS_OVERRIDES = {
  ProductsPage: ProductsPageComposed,
  CoordinatedProducts: CoordinatedProductsComposed,
} as const;
