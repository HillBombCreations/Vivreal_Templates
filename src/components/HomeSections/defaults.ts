import type { HomeSection } from "@/types/SiteData";

interface PageLike {
  format?: string;
}

export function getDefaultHomeSections(pages: PageLike[]): HomeSection[] {
  const formats = new Set(pages.map((p) => p.format));

  if (formats.has("products")) {
    return [
      { type: "hero-ecommerce", order: 1, enabled: true, config: {} },
      { type: "product-showcase", order: 2, enabled: true, config: {} },
      { type: "offerings", order: 3, enabled: true, config: {} },
      { type: "contact", order: 4, enabled: true, config: {} },
      { type: "cta", order: 5, enabled: true, config: { linkTo: "/products", label: "Browse products", heading: "Find something you love", subheading: "Explore our full collection of products — new arrivals, best-sellers, and more." } },
    ];
  }

  if (formats.has("shows")) {
    return [
      { type: "hero", order: 1, enabled: true, config: { showUpcoming: true, showPartners: true } },
      { type: "email-popup", order: 2, enabled: true, config: { delayMs: 3000 } },
      { type: "highlights", order: 3, enabled: true, config: {} },
      { type: "testimonials", order: 4, enabled: true, config: {} },
      { type: "cta", order: 5, enabled: true, config: { targetFormat: "form" } },
    ];
  }

  return [
    { type: "hero", order: 1, enabled: true, config: {} },
    { type: "cta", order: 2, enabled: true, config: {} },
  ];
}
