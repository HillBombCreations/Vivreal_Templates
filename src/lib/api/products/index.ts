import "server-only";
import { clientFetchSafe } from "../client";
import { getSignedUrl } from "../media";
import type { Product, Filter } from "@/types/Products";

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
  filterKey?: string;
  filterVal?: string;
  searchVal?: string;
  sortVal?: string;
}): Promise<Product[]> {
  const params = new URLSearchParams({ type: "stripe" });
  if (opts?.filterKey) params.set("filterKey", opts.filterKey);
  if (opts?.filterVal) params.set("filterVal", opts.filterVal);
  if (opts?.searchVal) params.set("searchVal", opts.searchVal);
  if (opts?.sortVal) params.set("sortVal", opts.sortVal);

  const raw = await clientFetchSafe<Record<string, unknown>[]>(
    `/tenant/integrationObjects?${params}`,
    []
  );
  return raw.map(transformProduct);
}

export async function getProductById(productId: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => p._id === productId) ?? null;
}

export async function getFilters(collectionId: string): Promise<Filter[]> {
  if (!collectionId) return [];
  const raw = await clientFetchSafe<Record<string, unknown>[]>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    []
  );
  return raw.map((item) => {
    const obj = (item.objectValue ?? item) as Record<string, unknown>;
    return {
      title: String(obj.title ?? ""),
      key: String(obj.key ?? ""),
      filters: Array.isArray(obj.filters) ? obj.filters.map(String) : [],
    };
  });
}
