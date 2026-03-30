import type { HomeSection, SiteData, HomeSectionProps } from "../types/SiteData";

import HeroSectionEcommerce from "./HeroSectionEcommerce";
import HeroSectionShowcase from "./HeroSectionShowcase";
import ProductShowcase from "./ProductShowcase";
import Offerings from "./Offerings";
import CTASection from "./CTASection";
import ContactSection from "./ContactSection";

export type { HomeSectionProps };

export function HomeSectionRenderer({
  section,
  siteData,
  prefetchedData,
}: {
  section: HomeSection;
  siteData: SiteData;
  prefetchedData?: Record<string, unknown>;
}) {
  const props: HomeSectionProps = { config: section.config, siteData, prefetchedData };

  switch (section.type) {
    case "hero-ecommerce":
      return <HeroSectionEcommerce {...props} />;
    case "product-showcase":
      return <ProductShowcase {...props} />;
    case "offerings":
      return <Offerings {...props} />;
    case "cta":
      return <CTASection {...props} />;
    case "contact":
      return <ContactSection {...props} />;
    case "hero-showcase":
      return <HeroSectionShowcase siteData={siteData} config={section.config} prefetchedData={prefetchedData} />;
    default:
      return null;
  }
}
