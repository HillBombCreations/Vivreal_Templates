import "server-only";
import { clientFetchCached, SITE_CACHE_TTL_SECONDS, readBotVerdict } from "../client";
import { BOT_VERDICT_HEADER } from "../../botVerdict";
// A failed read and an empty catalogue are the same value once the fetch helper
// has swallowed the error, so any caller that concludes something from
// emptiness has to be told which one it got. See ../degradedRead.ts.
import { readOrDegrade } from "../degradedRead";
// Pure raw → Product mapping lives in its own module so it can be unit-tested
// under plain Node (`node --test`) — this file is `server-only` and cannot be
// loaded there. Same split as `../collections/mapItem.ts`.
import { transformProduct } from "./transformProduct.ts";
// Same split, same reason: the query builder is pure so `node --test` can pin
// the fetch window. See that module's docblock for why the limit is explicit.
import { buildProductsQuery } from "./productsQuery.ts";
import type { Product, Filter } from "@/types/Products";

const SITE_ID = process.env.SITE_ID || "";

/**
 * Cache tags for a product read. Products come from an integration object
 * (`integrationObjects?type=<type>`), so the read carries `integration:<type>`
 * (a sync/edit of that integration invalidates exactly it) plus `site:<id>` so a
 * site-wide invalidation clears it too. Tags map 1:1 to /api/revalidate decoding.
 */
function productTags(type: string): string[] {
  const tags: string[] = [];
  if (SITE_ID) tags.push(`site:${SITE_ID}`);
  if (type) tags.push(`integration:${type}`);
  return tags;
}

/** Cache tags for a filter read (a collection's objects). */
function filterTags(collectionId: string): string[] {
  const tags: string[] = [];
  if (SITE_ID) tags.push(`site:${SITE_ID}`);
  if (collectionId) tags.push(`collection:${collectionId}`);
  return tags;
}

interface PaginatedResponse {
  items: Record<string, unknown>[];
  totalCount: number;
}

function unwrapItems(raw: PaginatedResponse | Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw;
  return (raw as PaginatedResponse)?.items ?? [];
}

export interface ProductsOpts {
  filters?: Record<string, string>;
  searchVal?: string;
  sortVal?: string;
  integrationType?: string;
}

/**
 * The products read, WITH whether it actually happened.
 *
 * `getProducts` below is the value-only view of this, for the callers that have
 * no verdict to draw from an empty result. Anything that could turn "no
 * products" into a claim (the generic-format 404 in
 * `../composition/pageEmptiness.ts`, reached through the products bridge) must
 * use this one: a storefront group composes onto ordinary `grid` and `list`
 * pages, so a degraded products read can reach that 404 exactly as a degraded
 * collection read can.
 */
export async function getProductsRead(
  opts?: ProductsOpts,
): Promise<{ products: Product[]; degraded: boolean }> {
  const params = buildProductsQuery(opts);

  const type = opts?.integrationType || "stripe";
  // Task 14 item 3 (dashboard-insights-phase-3-capture/plan.md, D7) --
  // relay the edge-computed bot verdict on this read. A bot request served
  // from the Next.js data cache or CloudFront never reaches VR_Client_API
  // at all (both sit in front of this call), so the header only affects a
  // CACHE MISS -- which is the correct and sufficient scope: a repeat/
  // cached bot hit was never going to be captured a second time anyway.
  const botVerdict = await readBotVerdict();
  const { value: raw, degraded } = await readOrDegrade<PaginatedResponse>(
    () => ({ items: [], totalCount: 0 }),
    (fallback) =>
      clientFetchCached<PaginatedResponse>(
        `/tenant/integrationObjects?${params}`,
        fallback,
        SITE_CACHE_TTL_SECONDS,
        { headers: { [BOT_VERDICT_HEADER]: botVerdict } },
        productTags(type)
      )
  );
  return { products: unwrapItems(raw).map(transformProduct), degraded };
}

/**
 * Products only. The value-only view of `getProductsRead`, kept so the callers
 * that only render what came back do not have to unwrap a flag they ignore.
 *
 * `getProductById` is NOT such a caller, and saying so would be wrong. It is a
 * client-side `.find()` over this list, so a degraded read makes it return
 * `null`, and `[slug]/[itemId]/page.tsx` turned that into `redirectOrNotFound()`
 * on every product detail URL on the site. That was the same manufactured 404
 * this change set exists to remove, on a different route, and it is why
 * `getProductByIdRead` below exists.
 */
export async function getProducts(opts?: ProductsOpts): Promise<Product[]> {
  return (await getProductsRead(opts)).products;
}

/**
 * One product, WITH whether the list it was looked up in was actually read.
 *
 * The detail route's product arm is the caller that has a verdict to draw: on a
 * `products`-format page a miss is terminal and used to 404, and on any other
 * page carrying a storefront binding a miss falls THROUGH to the collection and
 * menu arms, which means this flag has to survive into them. Both are why it is
 * returned rather than dropped here.
 */
export async function getProductByIdRead(
  productId: string,
  integrationType?: string,
): Promise<{ product: Product | null; degraded: boolean }> {
  // Omitted integrationType falls back to stripe inside getProductsRead — the
  // legacy default for callers that don't know the page's payments provider.
  //
  // There is no by-id read on VR_Client_API, so this detail page can only find
  // a product inside the window `getProductsRead` asks for. That window used to
  // be the server's 20-row default, which meant a merchant's 21st product had
  // no detail page — its card linked to a 404 with no error anywhere. It is now
  // PRODUCTS_FETCH_LIMIT (100, the server ceiling); past that a by-id route is
  // required. See ./productsQuery.ts.
  const { products, degraded } = await getProductsRead({ integrationType });
  return { product: products.find((p) => p._id === productId) ?? null, degraded };
}

export async function getProductById(productId: string, integrationType?: string): Promise<Product | null> {
  return (await getProductByIdRead(productId, integrationType)).product;
}

export async function getFilters(collectionId: string): Promise<Filter[]> {
  if (!collectionId) return [];
  const raw = await clientFetchCached<PaginatedResponse>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    { items: [], totalCount: 0 },
    SITE_CACHE_TTL_SECONDS,
    undefined,
    filterTags(collectionId)
  );
  return unwrapItems(raw).map((item) => {
    const obj = (item.objectValue ?? item) as Record<string, unknown>;
    return {
      title: String(obj.title ?? ""),
      key: String(obj.key ?? ""),
      filters: Array.isArray(obj.filters) ? obj.filters.map(String) : [],
      type: obj.type ? String(obj.type) : undefined,
    };
  });
}
