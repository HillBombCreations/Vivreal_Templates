"use client";

import { useSiteData } from "@/contexts/SiteDataContext";
import { HeroSectionProps } from "@/types/Landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HeroSection = ({ heroSection }: HeroSectionProps) => {
  const siteData = useSiteData();
  const primary = siteData?.siteDetails?.primary ?? "#365b99";
  const surface = siteData?.siteDetails?.surface ?? "#ffffff";
  const textPrimary = siteData?.siteDetails?.["text-primary"] ?? "#0b1220";
  const textMuted = siteData?.siteDetails?.["text-secondary"] ?? "#5b6475";

  const title = heroSection?.title ?? "Your Store";
  const subtitle = heroSection?.subtitle ?? "Discover best-sellers, new arrivals, and everyday essentials—delivered fast.";
  const imageSrc = heroSection?.imageUrl || "/heroImage.png";

  const ctaLabel = heroSection?.buttonLabel ?? "Shop new arrivals";

  return (
    <section
      style={{ background: surface }}
      className="relative min-h-[100svh] overflow-hidden pt-20 md:pt-28 pb-16 md:pb-24"
      aria-labelledby="hero-heading"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl opacity-25"
        style={{
          background: `radial-gradient(circle at center, ${primary} 0%, transparent 70%)`,
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-[-120px] h-[520px] w-[520px] rounded-full blur-3xl opacity-20"
        style={{
          background: `radial-gradient(circle at center, ${primary} 0%, transparent 70%)`,
        }}
      />

      <div className="mx-5 mt-10 sm:mt-0 md:mx-20 lg:mx-40 min-h-[calc(100svh-6rem)] flex items-center">
        <div className="grid w-full items-center gap-10 md:gap-14 lg:gap-16 md:grid-cols-2">
          <div className="order-1 text-center md:text-left">
            <h1
              id="hero-heading"
              className="text-[42px] leading-[1.05] md:text-6xl font-semibold tracking-tight"
              style={{ color: textPrimary }}
            >
              <span className="block text-[12px] font-semibold tracking-[0.2em] uppercase opacity-70">
                Welcome To
              </span>
              <span className="block mt-3">
                <span style={{ color: primary }}>{title}</span>
              </span>
            </h1>

            <p
              className="mt-5 text-[15px] leading-relaxed md:text-lg max-w-xl mx-auto md:mx-0"
              style={{ color: textMuted }}
            >
              {subtitle}
            </p>

            <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <a
                href={"/products"}
                className="h-11 px-5 inline-flex items-center justify-center rounded-xl text-sm font-semibold shadow-sm transition active:scale-[0.99]"
                style={{ background: primary, color: "white" }}
              >
                {ctaLabel}
              </a>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-2 max-w-xl mx-auto md:mx-0">
              {[
                "Freshly made to order",
                "High-quality ingredients",
                "Secure checkout",
              ].map((t) => (
                <div
                  key={t}
                  className="
                    flex items-center justify-center
                    rounded-xl border px-3 py-2
                    text-[11px] font-semibold text-center
                  "
                  style={{ borderColor: primary, color: textPrimary }}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="order-2">
            <div className="w-full h-[320px] sm:h-[380px] md:h-[520px] lg:h-[620px] flex items-center justify-center">
              <img
                src={imageSrc}
                alt="Hero illustration"
                className="flex w-full h-full object-contain"
                draggable={false}
              />
            </div>

            <div className="flex items-start justify-center md:justify-end text-[11px] font-semibold opacity-80">
              <span style={{ color: textMuted }}>Trusted by shoppers</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;