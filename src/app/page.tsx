/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getLandingSections,
  getOurOfferings,
  getProductShowcase
} from '@/lib/api/Landing';
import { Suspense } from "react";
import {
  OurOfferings,
  ProductShowcase,
  LANDING_SECTION_API,
  OUR_OFFERINGS_API,
  PRODUCT_SHOWCASE_API
} from '@/types/Landing';
import { headers } from "next/headers";
import { SITE_DATA_API } from '@/types/SiteData';
import { getSiteData } from '@/lib/api/siteData';
import LandingSkeleton from "./loading";
import LandingWrapper from '@/components/Landing';
export const dynamic = "force-dynamic"

export default async function Index() {    
    return (
      <Suspense fallback={<LandingSkeleton />}>
        <Resolved />
      </Suspense>
    );
};

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

async function Resolved() {
  const landingSectionUrl = await handleBuildUrl(LANDING_SECTION_API);
  const productShowcaseUrl = await handleBuildUrl(PRODUCT_SHOWCASE_API);
  const ourOfferingsUrl = await handleBuildUrl(OUR_OFFERINGS_API);
  const landingSections = await getLandingSections(landingSectionUrl.toString()) as Record<string, any>;
  const productShowcase = await getProductShowcase(productShowcaseUrl.toString()) as ProductShowcase[];
  const ourOfferings = await getOurOfferings(ourOfferingsUrl.toString()) as OurOfferings[];

  return <LandingWrapper landingSections={landingSections} productShowcase={productShowcase} ourOfferings={ourOfferings} />;
}

export const generateMetadata = async () => {
  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const siteData = await getSiteData(siteDataUrl.toString());
  
  const description = `Explore ${siteData?.name}, where quality products meet a modern shopping experience.`;


  return {
    title: siteData?.name,
    description: description,
    openGraph: {
      title: siteData?.name,
      description: description,
      url: `https://${siteData.domainName}`,
      images: siteData?.siteDetails?.logo?.imageUrl
        ? [
            {
              url: siteData?.siteDetails?.logo?.imageUrl,
              width: 1200,
              height: 630,
              alt: siteData?.name,
            },
          ]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: siteData?.name,
      description: description,
      images: siteData?.siteDetails?.logo?.imageUrl ? [siteData?.siteDetails?.logo?.imageUrl] : [],
    },
  };
};