import { Suspense } from "react";
import type { CoordinatedProductsProps, ProductsPageProps } from "@hillbombcreations/site-renderer";
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
 *
 * F323 (release C): each override sits in its OWN empty box, and these are the
 * only boxes a client hook may lean on. The pages around them have none, so
 * they are sent complete. The shop's hook (`useProductsLiveAdapters`) calls
 * `useSearchParams()`. In a request render (the shop page, `/menu`) the hook
 * reads the request and the box never shows its fallback, so the shop is sent
 * complete too. In a server rebuild of a stored page that gained a shop
 * section after the last build, the hook's signal stops at this box: that one
 * section is drawn by the browser until the next build, the rest of the page is
 * sent complete, and the page answers 200. Without the box the whole page would
 * bail to the browser. `pageBoundaries.test.ts` pins both boxes, and refuses an
 * import of either component anywhere else.
 *
 * No "use client" here: the wrappers are server functions, which works because
 * the renderer draws an override as a plain element on the server.
 */
export const LIVE_PRODUCTS_OVERRIDES = {
  ProductsPage: (p: ProductsPageProps) => (
    <Suspense fallback={null}><ProductsPageComposed {...p} /></Suspense>
  ),
  CoordinatedProducts: (p: CoordinatedProductsProps) => (
    <Suspense fallback={null}><CoordinatedProductsComposed {...p} /></Suspense>
  ),
} as const;
