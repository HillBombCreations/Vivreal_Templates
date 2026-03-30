import { jsx as _jsx } from "react/jsx-runtime";
import HeroSectionEcommerce from "./HeroSectionEcommerce";
import HeroSectionShowcase from "./HeroSectionShowcase";
import ProductShowcase from "./ProductShowcase";
import Offerings from "./Offerings";
import CTASection from "./CTASection";
import ContactSection from "./ContactSection";
export function HomeSectionRenderer({ section, siteData, prefetchedData, }) {
    const props = { config: section.config, siteData, prefetchedData };
    switch (section.type) {
        case "hero-ecommerce":
            return _jsx(HeroSectionEcommerce, { ...props });
        case "product-showcase":
            return _jsx(ProductShowcase, { ...props });
        case "offerings":
            return _jsx(Offerings, { ...props });
        case "cta":
            return _jsx(CTASection, { ...props });
        case "contact":
            return _jsx(ContactSection, { ...props });
        case "hero-showcase":
            return _jsx(HeroSectionShowcase, { siteData: siteData, config: section.config, prefetchedData: prefetchedData });
        default:
            return null;
    }
}
