/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense } from "react";
import { headers, cookies } from "next/headers";
import { getProductById } from "@/lib/api/Products";
import { PRODUCTS_API } from "@/types/Products"
import { SITE_DATA_API } from "@/types/SiteData"
import { getSiteData } from "@/lib/api/siteData";
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
  const getSafeFieldValue = (obj: any, field: string) => {
    const selected = obj?.usingVariant?.values?.length > 0 ? obj.usingVariant.values[0] : null;

    if (
      typeof obj?.[field] === "object" &&
      obj?.[field] !== null &&
      Array.isArray(obj?.usingVariant?.values) &&
      obj.usingVariant.values.some((val: string) =>
        Object.keys(obj?.[field] || {}).includes(val)
      )
    ) {
      return obj[field][selected];
    }

    return obj?.[field];
  };

  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const productsUrl = await handleBuildUrl(PRODUCTS_API);

  const product = await getProductById(productsUrl.apiUrl.toString(), productId);
  const siteData = await getSiteData(siteDataUrl.apiUrl.toString());
  const title = getSafeFieldValue(product, 'name');
  const description = getSafeFieldValue(product, 'description');
  const imageUrl = getSafeFieldValue(product, 'imageUrl');

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
      title: title,
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
      title: title,
      description: description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
};