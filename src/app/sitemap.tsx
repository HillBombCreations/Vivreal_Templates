import type { MetadataRoute } from "next";
import { getProductsForSitemap } from "@/lib/api/Products";
import { PRODUCTS_API, Product } from "@/types/Products";
import { headers } from 'next/headers'

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return {base: base, apiUrl: url};
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { base, apiUrl } = await handleBuildUrl(PRODUCTS_API);
  const now = new Date();

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/products`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = (await getProductsForSitemap(apiUrl.toString())) as Product[];
      productRoutes = products
        .map((p: Product) => p?._id)
        .filter(Boolean)
        .map((id: string) => ({
          url: `${base}/products/${encodeURIComponent(id)}`,
          lastModified: now,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        }));
  } catch {
    // If products API fails, still return static routes
  }

  return [...staticRoutes, ...productRoutes];
}