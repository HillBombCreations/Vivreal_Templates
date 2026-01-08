import { Suspense } from "react";
import { headers } from "next/headers";
import { getProductById } from "@/lib/api/Products";
import { Product, PRODUCTS_API } from "@/types/Products"
import { SITE_DATA_API, SiteData } from "@/types/SiteData"
import { getSiteData } from "@/lib/api/SiteData";
import { getSafeFieldValue } from "@/lib/utils/variantUtils";
import ProductPageSkeleton from "./loading";
import ClientWrapper from "@/components/Products/ProductPage";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  return (
    <section
      className="min-h-[100dvh] flex flex-col"
      style={{ background: "var(--surface)" }}
    >
      <Suspense fallback={<ProductPageSkeleton />}>
        <Resolved productId={productId} />
      </Suspense>
    </section>
  );
}

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const apiUrl = new URL(`${base}/api/${type}`);
  return { base, apiUrl }
};

async function Resolved({
  productId,
}: {
  productId: string
}) {
  const { base, apiUrl } = await handleBuildUrl(PRODUCTS_API);
  const product = await getProductById(apiUrl.toString(), productId);
  
  return (
    <ClientWrapper originUrl={base} product={product} />
  );
}



export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ productId: string }>;
}) => {
  const { productId } = await params;

  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const productsUrl = await handleBuildUrl(PRODUCTS_API);

  const product = await getProductById(productsUrl.apiUrl.toString(), productId) as Product;

  const siteData = await getSiteData(siteDataUrl.apiUrl.toString()) as SiteData;
  
  const title = getSafeFieldValue(product, 'name', null);
  const description = getSafeFieldValue(product, 'description', null);
  const imageUrl = getSafeFieldValue(product, 'imageUrl', null);

  if (!product) {
    return {
      title: `Product not found | ${siteData?.name}`,
      description: "Sorry, we couldn’t find that product.",
    };
  }

  return {
    title: `${title} | ${siteData?.name}`,
    description: description,
    openGraph: {
      title: `${title} | ${siteData?.name}`,
      description: description,
      url: `https://${siteData.domainName}/products/${productId}`,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteData?.name}`,
      description: description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
};