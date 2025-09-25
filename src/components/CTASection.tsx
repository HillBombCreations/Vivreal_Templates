

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const CTASection = ({ page }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="content-grid">
        <div className="bg-primary rounded-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 to-primary"></div>
          
          <div className="relative z-10 p-10 md:p-16 text-center">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-4xl font-display font-bold tracking-tight text-white mb-4 animate-fade-in">
                Ready to transform your content management?
              </h2>
              <p className="text-primary-foreground/90 text-md md:text-lg mb-8 max-w-2xl mx-auto animate-fade-in" style={{ animationDelay: '100ms' }}>
                We're empowering companies of all sizes to deliver better digital experiences with Vivreal.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '200ms' }}>
                <a
                  href="https://app.vivreal.io/register/"
                  className="text-primary hover:underline transition-colors"
                  onClick={() => {
                    if (window.gtag) {
                      window.gtag('event', 'click', {
                        event_category: isMobile ? `${page}_MobileCTA` : `${page}_DesktopCTA`,
                        event_label: 'Start for free',
                        value: 1
                      });
                    }
                  }}
                >
                  <Button size="lg" variant="secondary" className="font-medium bg-white text-primary hover:bg-white/90">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              </div>
              <p className="text-primary-foreground/80 text-sm mt-6 animate-fade-in" style={{ animationDelay: '300ms' }}>
                Free forever. No credit card required.
              </p>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute -bottom-10 -right-10 h-40 w-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -top-10 -left-10 h-40 w-40 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
