/**
 * Parse the products storefront's controlled-query params — `f_<key>` facet
 * filters + `search` + `sort` — from a route's awaited searchParams.
 *
 * Extracted from the [slug] products arm so EVERY composed format threads the
 * same query into buildPageContext. A products storefront group is composable
 * on ANY page (universal page model), and its toolbar round-trips state
 * through these URL params — the server must parse them wherever the grid can
 * render, not only on `format:'products'` pages. (First live Square E2E: the
 * catalog-format Shop page's grid was inert without this.)
 */
export type ProductQuery = {
  filters?: Record<string, string>;
  search?: string;
  sort?: string;
};

export function parseProductQuery(
  sp: Record<string, string | string[] | undefined>,
): ProductQuery {
  const filters: Record<string, string> = {};
  for (const [key, val] of Object.entries(sp)) {
    if (key.startsWith("f_") && typeof val === "string" && val) {
      filters[key.slice(2)] = val;
    }
  }
  return {
    filters,
    search: typeof sp.search === "string" ? sp.search : undefined,
    sort: typeof sp.sort === "string" ? sp.sort : undefined,
  };
}
