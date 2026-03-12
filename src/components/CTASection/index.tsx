"use client";

import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import { useSiteData } from '@/contexts/SiteDataContext';

const CTASection = () => {
  const siteData = useSiteData();
  const primary = siteData?.primary || '#000000';

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
                Enjoyed your visit?
              </h2>
              <p
                className="text-md md:text-lg mb-8 max-w-2xl mx-auto animate-fade-in text-white/90"
                style={{ animationDelay: '100ms' }}
              >
                We&apos;d love to hear what you think! Take a moment to share your experience by leaving us a review.
              </p>
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
                style={{ animationDelay: '200ms' }}
              >
                <a href="/review">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="font-medium cursor-pointer bg-white text-gray-900 hover:bg-white/90"
                  >
                    Leave a Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
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
