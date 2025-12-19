/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Products
} from "@/types/Products";

export async function getProducts(url: string): Promise<Products[]> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}

export async function getProductById(url: string, productId: string): Promise<Products | null> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return null;
  }

  const products = await res.json() as any;
  const product = (products || []).find((p: any) => String(p?._id) === String(productId)) || null;
  return product;
}