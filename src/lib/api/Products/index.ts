import {
  Product
} from "@/types/Products";
import { unstable_cache } from "next/cache";

export async function getProducts(url: string): Promise<Product[]> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}

export async function getProductById(url: string, productId: string): Promise<Product | null> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return null;
  }

  const products = await res.json() as Product[];
  const product = (products || []).find((p: Product) => String(p?._id) === String(productId)) || null;
  return product;
}

export const getProductsForSitemap = unstable_cache(
  async (url: string) => {
    const res = await fetch(url, {
      next: { revalidate: 30 * 60 },
    });
    if (!res.ok) return [];
    return await res.json() as Product[];
  },
  ["filters"],
  { revalidate: 30 * 60 }
);