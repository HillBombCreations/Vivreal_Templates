import {
  Product
} from "@/types/Products";

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