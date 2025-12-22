
import {
  LandingSection,
  ProductShowcase,
  OurOfferings,
  LandingSections,
  ContactSectionContent
} from "@/types/Landing";

export async function getLandingSections(url: string): Promise<LandingSections | null> {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    console.error("[getLandingSections] upstream error:", res.status, res.statusText);
    return null;
  }

  const data: LandingSection[] = await res.json();
  const landingSectionObj = {} as LandingSections;

  data.forEach((section) => {
    switch (section.sectionName) {
      case 'firstSection':
        landingSectionObj.heroSection = section;
        break;
      case 'secondSection':
        landingSectionObj.productShowcase = section;
        break;
      case 'thirdSection':
        landingSectionObj.aboutUs = section;
        break;
      case 'fourthSection':
        landingSectionObj.contactUs = section as ContactSectionContent;
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