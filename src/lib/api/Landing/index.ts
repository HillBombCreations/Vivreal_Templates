
import {
  LandingSection,
  ProductShowcase,
  OurOfferings,
  LandingSections,
  ContactSectionContent,
  CallToActionContent
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
      case 'heroSection':
        landingSectionObj.heroSection = section;
        break;
      case 'productSection':
        landingSectionObj.productShowcase = section;
        break;
      case 'aboutUsSection':
        landingSectionObj.aboutUs = section;
        break;
      case 'contactSection':
        landingSectionObj.contactUs = section as ContactSectionContent;
        break;
      case 'ctaSection':
        landingSectionObj.ctaSection = section as CallToActionContent;
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