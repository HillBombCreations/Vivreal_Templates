import { Suspense } from "react";
import ProductsSkeleton from "./loading";
import ProductsPageClient from "@/components/Products";
import { headers } from "next/headers";
import { getProducts } from "@/lib/api/Products";
import { PRODUCTS_API, COLLECTIONS_API, Product, Filter } from "@/types/Products";
import { SITE_DATA_API } from "@/types/SiteData";
import { getSiteData } from "@/lib/api/SiteData";
import { getCollection } from "@/lib/api/Collection";
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
  searchParams: Promise<{ filter?: string, filterType?: string, search?: string, sort?: string }>;
}) {
  const { filter, filterType, search, sort } = await searchParams;

  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <Resolved filter={filter ?? ""} filterType={filterType ?? ""} search={search ?? ""} sort={sort ?? ""} />
    </Suspense>
  );
}

async function Resolved({ filter, filterType, search, sort }: { filter: string, filterType: string, search: string, sort: string }) {
  const productsUrl = await handleBuildUrl(PRODUCTS_API);
  const filtersUrl = await handleBuildUrl(COLLECTIONS_API);
  
  if (sort) productsUrl.searchParams.set("sortVal", sort);
  if (search) productsUrl.searchParams.set("searchVal", search);
  if (filter) productsUrl.searchParams.set("filterVal", filter);
  if (filterType) productsUrl.searchParams.set("filterKey", filterType);

  const products = (await getProducts(productsUrl.toString())) as Product[];
  const filters = (await getCollection(filtersUrl.toString()) as Filter[]);
  const variantDefaults: Record<string, string> = {};

  (products || []).forEach((p: Product) => {
    const values = p?.usingVariant?.values;
    if (Array.isArray(values) && values.length) {
      variantDefaults[p._id] = values[0];
    }
  });

  return (
    <ProductsPageClient
      products={products}
      initialFilter={filter}
      search={search}
      sort={sort}
      filters={filters}
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
      url: `${siteData?.domainInformation?.live_url}/products`,
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