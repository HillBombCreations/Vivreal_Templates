/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from "react";
import ProductsSkeleton from "./loading";
import ProductsPageClient from "@/components/Products";
import { headers } from "next/headers";
import { getProducts } from "@/lib/api/Products";
import { PRODUCTS_API, Products } from "@/types/Products";
import { SITE_DATA_API } from "@/types/SiteData";
import { getSiteData } from "@/lib/api/siteData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  return new URL(`${base}/api/${type}`);
};

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;

  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Resolved filter={filter ?? ""} />
    </Suspense>
  );
}

async function Resolved({ filter }: { filter: string }) {
  const productsUrl = await handleBuildUrl(PRODUCTS_API);

  const url = new URL(productsUrl.toString());
  if (filter) url.searchParams.set("filter", filter);

  const products = (await getProducts(url.toString())) as Products[];

  const filterSet = new Set<string>();
  const variantDefaults: Record<string, string> = {};

  (products || []).forEach((p: any) => {
    const ft = p?.["filter-type"] || p?.filterType || p?.objectValue?.["filter-type"];
    if (typeof ft === "string" && ft.length) filterSet.add(ft);

    const values = p?.usingVariant?.values;
    if (Array.isArray(values) && values.length) {
      variantDefaults[p._id] = values[0];
    }
  });

  return (
    <ProductsPageClient
      products={products}
      initialFilter={filter}
      filters={Array.from(filterSet)}
      initialSelectedVariants={variantDefaults}
    />
  );
};

export const generateMetadata = async () => {
  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const siteData = await getSiteData(siteDataUrl.toString());
  
  const description = `Browse our full collection of products from ${siteData?.name}. Find everything you need to shop with confidence.`;

  return {
    title: `Products | ${siteData?.name}`,
    description: description,
    openGraph: {
      title: `Products | ${siteData?.name}`,
      description: description,
      url: `https://${siteData.domainName}/products`,
      images: siteData?.siteDetails?.logo?.imageUrl
        ? [
            {
              url: siteData?.siteDetails?.logo?.imageUrl,
              width: 1200,
              height: 630,
              alt: `Products | ${siteData?.name}`,
            },
          ]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Products | ${siteData?.name}`,
      description: description,
      images: siteData?.siteDetails?.logo?.imageUrl ? [siteData?.siteDetails?.logo?.imageUrl] : [],
    },
  };
};