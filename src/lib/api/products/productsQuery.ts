/**
 * Pure query-string builder for the integration product read.
 *
 * Extracted from `./index.ts` (which is `server-only` and imports the fetch
 * client, so it cannot be loaded under plain Node) for the same reason
 * `transformProduct.ts` was: this dependency-free logic can then be unit-tested
 * directly with the repo's `node --test` harness. `index.ts` imports
 * `buildProductsQuery` for its fetchers; nothing else changes.
 *
 * WHY THE LIMIT IS HERE AND NOT LEFT TO THE SERVER DEFAULT.
 * `VR_Client_API/src/services/tenant/getIntegrationObjects.js` defaults
 * `limit = 20` and caps at 100 (`Math.min(limit, 100)`; the Joi validator in
 * `src/scripts/validators.js` also caps the query param at 100). The Studio
 * preview fetches the same products through `/integrations/get` at
 * `limit: 100` (`Vivreal_Portal_Mobile` `usePreviewData.ts`), and the live
 * COLLECTION read already asks for 100
 * (`../composition/buildPageContext.ts` `getCollectionItems(id, {limit: 100})`).
 * Products were the one read still riding the server default, so a storefront
 * with more than 20 products was complete in the Studio and truncated at the
 * URL.
 *
 * It was also a live bug on its own: `getProductById` searches only the window
 * this query returns, so at the 20-row default a merchant's 21st product had no
 * detail page at all — a card that 404s, with no error anywhere. Latent, not
 * biting: the largest catalog in the fleet today is 16 items.
 *
 * The remaining ceiling is 100 on BOTH surfaces (the server cap), which is the
 * same window collections have. Going past it needs a server-side by-id read
 * and is the same structural problem the preview-parity audit tracks as D14.
 */

/**
 * Rows requested per product read. 100 = the VR_Client_API ceiling, the live
 * collection window, and the Studio preview's integration window. Exported so
 * the cross-repo parity test can read one number rather than a call site.
 */
export const PRODUCTS_FETCH_LIMIT = 100;

export interface ProductsQueryOptions {
  filters?: Record<string, string>;
  searchVal?: string;
  sortVal?: string;
  integrationType?: string;
}

/**
 * Build the `/tenant/integrationObjects` query for a product read.
 *
 * `type` falls back to `stripe` — the legacy default for callers that don't
 * know the page's payments provider (see `getProductById`).
 */
export function buildProductsQuery(opts?: ProductsQueryOptions): URLSearchParams {
  const params = new URLSearchParams({
    type: opts?.integrationType || "stripe",
    limit: String(PRODUCTS_FETCH_LIMIT),
  });
  if (opts?.filters) {
    for (const [key, val] of Object.entries(opts.filters)) {
      if (key && val) params.set(`filters[${key}]`, val);
    }
  }
  if (opts?.searchVal) params.set("search", opts.searchVal);
  if (opts?.sortVal) params.set("sort", opts.sortVal);
  return params;
}
