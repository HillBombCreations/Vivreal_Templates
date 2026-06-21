import type { HomeSection, HomeSectionConfig, SiteData } from "@/types/SiteData";

// Showcase sections
import HighlightsSection from "./HighlightsSection";
import Testimonials from "./Testimonials";
// NOTE: EmailPopup is NOT a composable body section. CC9 moved it to site chrome
// (mounted in app/layout.tsx) so it can target any route + carry the authored
// emailPopup config. It is intentionally absent from this section registry.

// Ecommerce sections
import HeroSectionEcommerce from "./HeroSectionEcommerce";
import ProductShowcase from "./ProductShowcase";
import Offerings from "./Offerings";
import ContactSection from "./ContactSection";

export interface HomeSectionProps {
  config: HomeSectionConfig;
  siteData: SiteData;
  prefetchedData?: Record<string, unknown>;
}

interface HomeSectionRendererProps {
  section: HomeSection;
  siteData: SiteData;
  prefetchedData?: Record<string, unknown>;
}

export function HomeSectionRenderer({ section, siteData, prefetchedData }: HomeSectionRendererProps) {
  const props: HomeSectionProps = { config: section.config, siteData, prefetchedData };

  switch (section.type) {
    case "highlights":
      return <HighlightsSection {...props} />;
    case "testimonials":
      return <Testimonials {...props} />;
    case "hero-ecommerce":
      return <HeroSectionEcommerce {...props} />;
    case "product-showcase":
      return <ProductShowcase {...props} />;
    case "offerings":
      return <Offerings {...props} />;
    case "contact":
      return <ContactSection {...props} />;

    default:
      return null;
  }
}
