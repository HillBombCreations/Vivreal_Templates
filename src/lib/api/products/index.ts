import "server-only";
import { clientFetchCached, SITE_CACHE_TTL_SECONDS, readBotVerdict } from "../client";
import { BOT_VERDICT_HEADER } from "../../botVerdict";
// Pure raw → Product mapping lives in its own module so it can be unit-tested
// under plain Node (`node --test`) — this file is `server-only` and cannot be
// loaded there. Same split as `../collections/mapItem.ts`.
import { transformProduct } from "./transformProduct.ts";
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

export async function getProducts(opts?: {
  filters?: Record<string, string>;
  searchVal?: string;
  sortVal?: string;
  integrationType?: string;
}): Promise<Product[]> {
  const params = new URLSearchParams({ type: opts?.integrationType || "stripe" });
  if (opts?.filters) {
    for (const [key, val] of Object.entries(opts.filters)) {
      if (key && val) params.set(`filters[${key}]`, val);
    }
  }
  if (opts?.searchVal) params.set("search", opts.searchVal);
  if (opts?.sortVal) params.set("sort", opts.sortVal);

  const type = opts?.integrationType || "stripe";
  // Task 14 item 3 (dashboard-insights-phase-3-capture/plan.md, D7) --
  // relay the edge-computed bot verdict on this read. A bot request served
  // from the Next.js data cache or CloudFront never reaches VR_Client_API
  // at all (both sit in front of this call), so the header only affects a
  // CACHE MISS -- which is the correct and sufficient scope: a repeat/
  // cached bot hit was never going to be captured a second time anyway.
  const botVerdict = await readBotVerdict();
  const raw = await clientFetchCached<PaginatedResponse>(
    `/tenant/integrationObjects?${params}`,
    { items: [], totalCount: 0 },
    SITE_CACHE_TTL_SECONDS,
    { headers: { [BOT_VERDICT_HEADER]: botVerdict } },
    productTags(type)
  );
  return unwrapItems(raw).map(transformProduct);
}

export async function getProductById(productId: string, integrationType?: string): Promise<Product | null> {
  // Omitted integrationType falls back to stripe inside getProducts — the
  // legacy default for callers that don't know the page's payments provider.
  const products = await getProducts({ integrationType });
  return products.find((p) => p._id === productId) ?? null;
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
