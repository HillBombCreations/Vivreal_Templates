import type { HomeSection, HomeSectionConfig, SiteData } from "@/types/SiteData";

// Showcase sections
import HeroSection from "./HeroSection";
import HighlightsSection from "./HighlightsSection";
import Testimonials from "./Testimonials";
import CTASection from "./CTASection";
import EmailPopup from "./EmailPopup";

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
    case "hero":
      return <HeroSection {...props} />;
    case "highlights":
      return <HighlightsSection {...props} />;
    case "testimonials":
      return <Testimonials {...props} />;
    case "cta":
      return <CTASection {...props} />;
    case "email-popup":
      return <EmailPopup {...props} />;
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
