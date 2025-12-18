"use client";

import { Button } from '@/components/ui/Button';
import { ArrowRight } from 'lucide-react';
import { useSiteData } from '@/contexts/SiteDataContext';

const CTASection = () => {
  const siteData = useSiteData();

  return (
    <section className="py-10 md:py-16 relative overflow-hidden">
      <div className="content-grid">
        <div
          style={{
            background: siteData?.siteDetails?.["surface-alt"],
            backgroundSize: 'cover',
            backgroundRepeat: 'repeat',
            backgroundPosition: 'center',
          }}
          className="rounded-2xl overflow-hidden relative"
        >
          <div style={{ color: siteData?.siteDetails?.['text-inverse'] }} className="absolute inset-0 bg-gradient-to-br"></div>
          
          <div className="relative z-10 p-10 md:p-16 text-center">
            <div className="max-w-4xl mx-auto">
              <h2
                style={{
                  color: siteData?.siteDetails?.['surface-alt'],
                  backgroundColor: siteData?.siteDetails?.primary,
                  backdropFilter: 'blur(10px)',
                  borderRadius: '8px',
                  display: 'inline-block',
                  padding: '10px 25px'
                }}
                className="text-2xl md:text-4xl font-display font-bold tracking-tight mb-4 animate-fade-in"
              >
                Enjoyed your visit?
              </h2>
              <p
                style={{
                  color: siteData?.siteDetails?.['surface-alt'],
                  backgroundColor: siteData?.siteDetails?.primary,
                  backdropFilter: 'blur(10px)',
                  borderRadius: '8px',
                  padding: '10px 25px',
                  animationDelay: '100ms'
                }}
                className="text-md md:text-lg mb-8 max-w-2xl mx-auto animate-fade-in"
              >
                We’d love to hear what you think! Take a moment to share your experience by leaving us a review.
              </p>
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in"
                style={{ animationDelay: '200ms' }}
              >
                <a
                  href="/review"
                  className="text-primary hover:underline transition-colors"
                >
                  <Button
                    size="lg"
                    variant="secondary"
                    className="font-medium cursor-pointer bg-white text-primary hover:bg-white/90"
                  >
                    Leave a Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -top-10 -left-10 h-40 w-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;