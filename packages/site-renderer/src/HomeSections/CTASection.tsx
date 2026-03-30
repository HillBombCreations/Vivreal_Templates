import { ArrowRight } from "lucide-react";
import type { HomeSectionProps } from "../types/SiteData";

const CTASection = ({ config = {}, siteData }: Partial<HomeSectionProps>) => {
  const primary = siteData?.primary || "#000000";

  const targetFormat = config.targetFormat as string | undefined;
  const linkTo = config.linkTo as string | undefined;

  const targetPage = targetFormat
    ? siteData?.pageConfigs?.find((p) => p.format === targetFormat)
    : undefined;

  const href = linkTo || (targetPage ? `/${targetPage.slug}` : undefined);

  const effectiveFormat = targetFormat
    || siteData?.pageConfigs?.find((p) => linkTo === `/${p.slug}`)?.format;

  const formatDefaults: Record<string, { label: string; heading: string; subheading: string }> = {
    products: { label: "Browse products", heading: "Find something you love", subheading: "Explore our full collection — new arrivals, best-sellers, and more." },
    form: { label: "Leave a review", heading: "Enjoyed your visit?", subheading: "We'd love to hear what you think! Take a moment to share your experience." },
    shows: { label: "View events", heading: "Don't miss out", subheading: "Check out our upcoming events and secure your spot." },
  };

  const defaults = (effectiveFormat && formatDefaults[effectiveFormat]) || {
    label: "Learn more", heading: "Ready to get started?", subheading: "We'd love to help you find what you're looking for.",
  };

  const label = String((config.label as string) || targetPage?.labels?.navLabel || defaults.label);

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="content-grid">
        <div className="rounded-2xl overflow-hidden relative" style={{ backgroundColor: primary }}>
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />
          <div className="relative z-10 px-10 py-14 md:px-16 md:py-20 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-4xl font-bold tracking-tight mb-6 animate-fade-in text-white">
                {(config.heading as string) || defaults.heading}
              </h2>
              <p className="text-md md:text-lg mb-10 max-w-2xl mx-auto animate-fade-in text-white/90" style={{ animationDelay: "100ms" }}>
                {(config.subheading as string) || defaults.subheading}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: "200ms" }}>
                {href && (
                  <a
                    href={href}
                    className="inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full text-sm font-semibold bg-white text-gray-900 hover:bg-white/90 transition cursor-pointer"
                  >
                    {label}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -top-10 -left-10 h-40 w-40 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>
    </section>
  );
};

export default CTASection;
