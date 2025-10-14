"use client";

import { Button } from '@/components/UI/Button';
import { ArrowRight } from 'lucide-react';
import { useSiteData } from '@/contexts/SiteDataContext';

const CTASection = () => {
  const siteData = useSiteData();

  return (
    <section className="py-10 md:py-16 relative overflow-hidden">
      <div className="content-grid">
        <div style={{ background: siteData?.primary }} className="rounded-2xl overflow-hidden relative">
          <div style={{ color: siteData?.['text-inverse'] }} className="absolute inset-0 bg-gradient-to-br"></div>
          
          <div className="relative z-10 p-10 md:p-16 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 style={{ color: siteData?.['surface-alt'] }} className="text-2xl md:text-4xl font-display font-bold tracking-tight mb-4 animate-fade-in">
                Get in Touch
              </h2>
              <p className="text-primary-foreground/90 text-md md:text-lg mb-8 max-w-2xl mx-auto animate-fade-in" style={{ color: siteData?.['surface-alt'], animationDelay: '100ms' }}>
                Have questions or want to learn more? We’d love to hear from you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '200ms' }}>
                <a
                  href="/contact"
                  className="text-primary hover:underline transition-colors"
                >
                  <Button size="lg" variant="secondary" className="font-medium cursor-pointer bg-white text-primary hover:bg-white/90">
                    Contact Us
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