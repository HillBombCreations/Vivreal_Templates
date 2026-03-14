import "server-only";
import { clientFetchSafe } from "../client";
import { getSignedUrl } from "../media";
import type { Product, Filter } from "@/types/Products";

interface PaginatedResponse {
  items: Record<string, unknown>[];
  totalCount: number;
}

function unwrapItems(raw: PaginatedResponse | Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw;
  return (raw as PaginatedResponse)?.items ?? [];
}

function resolveProductImage(item: Record<string, unknown>): string {
  const objectValue = item.objectValue as Record<string, unknown> | undefined;
  const currentFile = objectValue?.currentFile as Record<string, unknown> | undefined;
  if (!currentFile) return "";
  return getSignedUrl(currentFile) || "";
}

function transformProduct(raw: Record<string, unknown>): Product {
  const objectValue = (raw.objectValue ?? {}) as Record<string, unknown>;
  const usingVariant = raw.usingVariant as Product["usingVariant"] | undefined;
  const imageUrl = resolveProductImage(raw);

  return {
    _id: String(raw._id ?? ""),
    name: (objectValue.name as Product["name"]) ?? "",
    price: (objectValue.price as Product["price"]) ?? "",
    description: (objectValue.description as Product["description"]) ?? "",
    imageUrl: imageUrl || ((objectValue.imageUrl as Product["imageUrl"]) ?? ""),
    link: (objectValue.link as string) ?? undefined,
    productType: (objectValue.productType as string) ?? undefined,
    buttonLabel: (objectValue.buttonLabel as string) ?? undefined,
    "filter-type": (objectValue["filter-type"] as string) ?? undefined,
    usingVariant,
    default_price: (objectValue.default_price as string) ?? undefined,
  };
}

export async function getProducts(opts?: {
  filters?: Record<string, string>;
  searchVal?: string;
  sortVal?: string;
}): Promise<Product[]> {
  const params = new URLSearchParams({ type: "stripe" });
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
