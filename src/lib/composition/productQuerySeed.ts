/**
 * The storefront controls' seed, taken from the query the route parsed and
 * filtered the items by (F323, release C; vivreal-hq
 * docs/projects/next-release-C/design-f323-shop-pages.md, Option A).
 *
 * Before this, the shop's hook read the address with `useSearchParams()`. That
 * hook throws in a server rebuild of a stored page (Next's `prerender-legacy`
 * work unit), so it needed a `<Suspense>` box, and React sends a finished box
 * over 500 bytes in a hidden segment once the page passes 12,800 bytes, which
 * hid every storefront from readers that run no scripts. Seeding from the
 * route's own `ProductQuery` needs no hook and no box.
 *
 * The seed copies the parsed query verbatim, with no drop of its own, so it is
 * exactly what the server applied: a repeated key (which `parseProductQuery`
 * drops) seeds nothing, and `?f_=x` seeds the same `""` key the server got.
 *
 * Plain `.ts` with an explicit `.ts` import so `node --test` can load it.
 */
import { parseProductQuery } from "./productQuery.ts";
import type { ProductQuery } from "./productQuery.ts";

export interface ProductQuerySeed {
  initialFilters: Record<string, string>;
  initialSearch: string | undefined;
  initialSort: string | undefined;
}

export function seedFromProductQuery(query?: ProductQuery): ProductQuerySeed {
  return {
    initialFilters: { ...(query?.filters ?? {}) },
    initialSearch: query?.search,
    initialSort: query?.sort,
  };
}

/** The route plus the hook, end to end: what a request's query seeds the controls with. */
export function seedForSearchParams(
  sp: Record<string, string | string[] | undefined>,
): ProductQuerySeed {
  return seedFromProductQuery(parseProductQuery(sp));
}
