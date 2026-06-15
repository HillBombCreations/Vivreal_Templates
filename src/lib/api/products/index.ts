import "server-only";
import { clientFetchSafe } from "../client";
import { getSignedUrl } from "../media";
import type { Product, Filter, Variantable } from "@/types/Products";

interface PaginatedResponse {
  items: Record<string, unknown>[];
  totalCount: number;
}

function unwrapItems(raw: PaginatedResponse | Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw;
  return (raw as PaginatedResponse)?.items ?? [];
}

interface ResolvedProductImages {
  /** One URL per variant (or a bare string) — backward-compatible `imageUrl`. */
  primary: Variantable<string>;
  /** Ordered gallery URLs — `string[]` (non-variant) or `{ variant: string[] }`. */
  gallery: Variantable<string[]>;
}

/** Signed URLs for an array of media descriptors (each has `currentFile.source`). */
function extractSources(arr: unknown[]): string[] {
  const out: string[] = [];
  for (const d of arr) {
    const url = getSignedUrl(d);
    if (url) out.push(url);
  }
  return out;
}

/**
 * Resolve `productImage` into a backward-compatible single URL (`primary`,
 * used as `imageUrl`) plus an ordered `gallery`. VR_Client_API sets
 * `currentFile.source` on each media descriptor. Handles every shape:
 *
 *  - single descriptor          `{ ..., currentFile }`        → primary=url,  gallery=[url]
 *  - variant→single descriptor  `{ v: { currentFile }, ... }` → primary={v:url}, gallery={v:[url]}
 *  - flat gallery array         `[ { currentFile }, ... ]`    → primary=first, gallery=[urls]
 *  - variant→gallery array      `{ v: [ {currentFile}, ...] }`→ primary={v:first}, gallery={v:[urls]}
 *
 * Single-key variant maps collapse to a bare string/array, matching the prior
 * `imageUrl` behavior so existing consumers see no change.
 */
function resolveProductImages(item: Record<string, unknown>): ResolvedProductImages {
  const empty: ResolvedProductImages = { primary: "", gallery: [] };
  const objectValue = item.objectValue as Record<string, unknown> | undefined;
  if (!objectValue) return empty;
  const productImage = objectValue.productImage;
  if (!productImage) return empty;

  // Flat gallery array (non-variant, migrated/new products).
  if (Array.isArray(productImage)) {
    const urls = extractSources(productImage);
    return { primary: urls[0] ?? "", gallery: urls };
  }

  if (typeof productImage === "object") {
    const pi = productImage as Record<string, unknown>;

    // Simple product — currentFile directly on the field (legacy single image).
    const directCf = (pi.currentFile as Record<string, string> | undefined)?.source;
    if (directCf) return { primary: directCf, gallery: [directCf] };

    // Variant product — each value is a descriptor (single) or an array (gallery).
    const primaryMap: Record<string, string> = {};
    const galleryMap: Record<string, string[]> = {};
    for (const key of Object.keys(pi)) {
      const val = pi[key];
      const urls = Array.isArray(val) ? extractSources(val) : [getSignedUrl(val)].filter(Boolean) as string[];
      if (urls.length) {
        galleryMap[key] = urls;
        primaryMap[key] = urls[0];
      }
    }
    const keys = Object.keys(primaryMap);
    if (keys.length === 0) return empty;
    // Collapse single-key maps to bare values (matches prior imageUrl logic).
    if (keys.length === 1) return { primary: primaryMap[keys[0]], gallery: galleryMap[keys[0]] };
    return { primary: primaryMap, gallery: galleryMap };
  }

  return empty;
}

function transformProduct(raw: Record<string, unknown>): Product {
  const objectValue = (raw.objectValue ?? {}) as Record<string, unknown>;
  const usingVariant = raw.usingVariant as Product["usingVariant"] | undefined;
  const { primary, gallery } = resolveProductImages(raw);

  return {
    _id: String(raw._id ?? ""),
    name: (objectValue.name as Product["name"]) ?? "",
    price: (objectValue.price as Product["price"]) ?? "",
    description: (objectValue.description as Product["description"]) ?? "",
    imageUrl: primary || ((objectValue.imageUrl as Product["imageUrl"]) ?? "") as Product["imageUrl"],
    gallery,
    link: (objectValue.link as string) ?? undefined,
    productType: (objectValue.productType as string) ?? undefined,
    buttonLabel: (objectValue.buttonLabel as string) ?? undefined,
    "filter-type": (objectValue["filter-type"] as string) ?? undefined,
    usingVariant,
    default_price: (objectValue.default_price as Product["default_price"]) ?? undefined,
    quantityOptions: Array.isArray(objectValue.quantityOptions) ? objectValue.quantityOptions as number[] : undefined,
    quantityUnit: (objectValue.quantityUnit as Product["quantityUnit"]) ?? undefined,
    stock: (objectValue.stock as Product["stock"]) ?? undefined,
    lowStockThreshold: typeof objectValue.lowStockThreshold === "number" ? objectValue.lowStockThreshold : undefined,
    // Public-sale DISPLAY fields (plan §5). Passed through verbatim — the
    // renderer's lib/sale.ts validates window/shape defensively. Display only;
    // Stripe applies the authoritative discount at checkout.
    salePercent: (objectValue.salePercent as Product["salePercent"]) ?? undefined,
    saleAmount: (objectValue.saleAmount as Product["saleAmount"]) ?? undefined,
    saleStart: typeof objectValue.saleStart === "string" ? objectValue.saleStart : undefined,
    saleEnd: typeof objectValue.saleEnd === "string" ? objectValue.saleEnd : undefined,
  };
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

  const raw = await clientFetchSafe<PaginatedResponse>(
    `/tenant/integrationObjects?${params}`,
    { items: [], totalCount: 0 }
  );
  return unwrapItems(raw).map(transformProduct);
}

export async function getProductById(productId: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p._id === productId) ?? null;
}

export async function getFilters(collectionId: string): Promise<Filter[]> {
  if (!collectionId) return [];
  const raw = await clientFetchSafe<PaginatedResponse>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    { items: [], totalCount: 0 }
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
