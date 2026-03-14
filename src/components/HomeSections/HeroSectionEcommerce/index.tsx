"use client";

import Link from "next/link";
import type { HomeSectionProps } from "../index";
import type { LandingSection } from "@/types/Landing";
import { ArrowRight, Truck, Shield, Star } from "lucide-react";

const HeroSectionEcommerce = ({ config, siteData, prefetchedData }: HomeSectionProps) => {
  const heroSection = prefetchedData?.heroSection as LandingSection | undefined;

  const primary = siteData?.primary ?? "#1a1a2e";
  const surface = siteData?.surface ?? "#ffffff";
  const textPrimary = siteData?.["text-primary"] ?? "#0b1220";
  const textMuted = siteData?.["text-secondary"] ?? "#64748b";

  const title = heroSection?.title ?? "Your Store";
  const subtitle =
    heroSection?.subtitle ??
    "Discover best-sellers, new arrivals, and everyday essentials — delivered fast.";
  const imageSrc = heroSection?.imageUrl || "/vrlogo.png";
  const ctaLabel = heroSection?.buttonLabel ?? "Shop new arrivals";
  const ctaHref = (config.linkTo as string) ?? "/products";

  const hasShipping = siteData?.businessInfo?.shipping !== false;
  const trustItems = [
    { icon: <Truck className="h-4 w-4" />, label: hasShipping ? "Fast delivery" : "Pickup available" },
    { icon: <Shield className="h-4 w-4" />, label: "Secure checkout" },
    { icon: <Star className="h-4 w-4" />, label: "Top quality" },
  ];

  return (
    <section
      style={{ background: surface }}
      className="relative min-h-[100svh] overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Background gradient orbs */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[120px] opacity-[0.07]"
        style={{ background: primary }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full blur-[100px] opacity-[0.05]"
        style={{ background: primary }}
      />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 min-h-[100svh] flex items-center">
        <div className="w-full grid items-center gap-12 lg:gap-20 lg:grid-cols-2 py-24 lg:py-0">
          {/* Text column */}
          <div className="order-1 text-center lg:text-left animate-fade-in-up">
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide uppercase mb-6"
              style={{ borderColor: `${primary}20`, color: textMuted }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: primary }}
              />
              Welcome to {siteData?.name || "our store"}
            </div>

            <h1
              id="hero-heading"
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08]"
              style={{ color: textPrimary }}
            >
              {title}
            </h1>

            <p
              className="mt-6 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0"
              style={{ color: textMuted }}
            >
              {subtitle}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href={ctaHref}
                className="group h-12 px-7 inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                style={{ background: primary, color: "white" }}
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex items-center gap-6 justify-center lg:justify-start">
              {trustItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-xs font-medium"
                  style={{ color: textMuted }}
                >
                  <span style={{ color: primary }}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Image column */}
          <div className="order-2 animate-scale-in">
            <div
              className="relative rounded-3xl overflow-hidden aspect-square lg:aspect-[4/5]"
              style={{ background: `${primary}06` }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${primary}08 0%, transparent 50%)`,
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageSrc}
                alt={`${title} hero image`}
                className="relative w-full h-full object-contain p-8 lg:p-12"
                draggable={false}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSectionEcommerce;
