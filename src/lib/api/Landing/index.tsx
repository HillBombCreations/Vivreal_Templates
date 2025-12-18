/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LandingSection,
  ProductShowcase,
  OurOfferings,
  LANDING_SECTION_API,
  OUR_OFFERINGS_API,
  PRODUCT_SHOWCASE_API
} from "@/types/Landing";

export async function getLandingSections(url: string): Promise<Record<string, any>> {
  const res = await fetch(url, { cache: "no-store" });

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

export async function getProductShowcase(url: string): Promise<ProductShowcase[]> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getProductShowcase] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}

export async function getOurOfferings(url: string): Promise<OurOfferings[]> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getOurOfferings] upstream error:", res.status, res.statusText);
    return [];
  }

  return await res.json();
}