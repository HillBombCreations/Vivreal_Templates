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
import LandingSkeleton from "./loader";
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

// TODO: fix image url to be from cms data
// export const generateMetadata = async () => {
//   const siteData = await getSiteData();
//   return {
//     title: siteData?.businessInfo?.name,
//     description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
//     openGraph: {
//       title: siteData?.businessInfo?.name,
//       description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
//       url: siteData?.domainName,
//       images:  [
//         {
//             url: new URL("/heroImage.png", "https://comedycollectivechi.com"),
//             width: 1200,
//             height: 630,
//             alt: "The Comedy Collective Logo",
//         },
//       ],
//       type: "article",
//     },
//     twitter: {
//       card: "summary_large_image",
//       title: siteData?.businessInfo?.name,
//       description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
//       images: [new URL("/heroImage.png", "https://comedycollectivechi.com")]
//     },
//   };
// }