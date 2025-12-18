/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LandingSection,
  ProductShowcase,
  OurOfferings,
  LANDING_SECTION_API,
  OUR_OFFERINGS_API,
  PRODUCT_SHOWCASE_API
} from "@/types/Landing";
import { headers } from "next/headers";

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

export async function getLandingSections(): Promise<Record<string, any>> {
  const url = await handleBuildUrl(LANDING_SECTION_API);

  const res = await fetch(url.toString(), {
    cache: "no-store"
  });

  if (!res.ok) {
    console.error("[getLandingSections] upstream error:", res.status, res.statusText);
    return [];
  }

  const data: LandingSection[] = await res.json();
  const landingSectionObj = {} as Record<string, any>;

  data.forEach((section) => {
    switch (section.sectionName) {
      case 'firstSection':
        landingSectionObj.heroSection = section;
        break;
      case 'secondSection':
        landingSectionObj.productShowcase = section;
        break;
      case 'thirdSection':
        landingSectionObj.ourOfferings = section;
        break;
      case 'fourthSection':
        landingSectionObj.contactUs = section;
        break;
    }
  });

  return landingSectionObj;
}

export async function getProductShowcase(): Promise<ProductShowcase[]> {
  const url = await handleBuildUrl(PRODUCT_SHOWCASE_API);

  const res = await fetch(url.toString(), {
    cache: "no-store"
  });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}

export async function getOurOfferings(): Promise<OurOfferings[]> {
  const url = await handleBuildUrl(OUR_OFFERINGS_API);

  const res = await fetch(url.toString(), {
    cache: "no-store"
  });

  if (!res.ok) {
    console.error("[getOurOfferings] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}