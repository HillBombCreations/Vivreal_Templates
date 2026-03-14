"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import { useSiteData } from '@/contexts/SiteDataContext';
import type { HomeSectionProps } from '../index';

const CTASection = ({ config = {}, siteData: siteDataProp }: Partial<HomeSectionProps>) => {
  const contextData = useSiteData();
  const siteData = siteDataProp || contextData;
  const primary = siteData?.primary || '#000000';

  // Determine the target page: use config.targetFormat to find a page by format,
  // or config.linkTo for a direct path
  const targetFormat = config.targetFormat as string | undefined;
  const linkTo = config.linkTo as string | undefined;

  const targetPage = targetFormat
    ? siteData?.pageConfigs?.find((p) => p.format === targetFormat)
    : undefined;

  const href = linkTo || (targetPage ? `/${targetPage.slug}` : undefined);

  // Derive the effective format: explicit targetFormat, or infer from linkTo path
  const effectiveFormat = targetFormat
    || siteData?.pageConfigs?.find((p) => linkTo === `/${p.slug}`)?.format;

  // Context-aware defaults based on what the CTA links to
  const formatDefaults: Record<string, { label: string; heading: string; subheading: string }> = {
    products: {
      label: "Browse products",
      heading: "Find something you love",
      subheading: "Explore our full collection — new arrivals, best-sellers, and more.",
    },
    form: {
      label: "Leave a review",
      heading: "Enjoyed your visit?",
      subheading: "We'd love to hear what you think! Take a moment to share your experience.",
    },
    shows: {
      label: "View events",
      heading: "Don't miss out",
      subheading: "Check out our upcoming events and secure your spot.",
    },
  };

  const defaults = (effectiveFormat && formatDefaults[effectiveFormat]) || {
    label: "Learn more",
    heading: "Ready to get started?",
    subheading: "We'd love to help you find what you're looking for.",
  };

  const label = (config.label as string) || targetPage?.labels?.navLabel || defaults.label;

  return (
    <section className="py-10 md:py-16 relative overflow-hidden">
      <div className="content-grid">
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ backgroundColor: primary }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent" />

          <div className="relative z-10 p-10 md:p-16 text-center">
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-2xl md:text-4xl font-display font-bold tracking-tight mb-4 animate-fade-in text-white"
              >
                {(config.heading as string) || defaults.heading}
              </h2>
              <p
                className="text-md md:text-lg mb-8 max-w-2xl mx-auto animate-fade-in text-white/90"
                style={{ animationDelay: '100ms' }}
              >
                {(config.subheading as string) || defaults.subheading}
              </p>
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
                style={{ animationDelay: '200ms' }}
              >
                {href && (
                  <Link href={href}>
                    <Button
                      size="lg"
                      variant="secondary"
                      className="font-medium cursor-pointer bg-white text-gray-900 hover:bg-white/90"
                    >
                      {label}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
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
