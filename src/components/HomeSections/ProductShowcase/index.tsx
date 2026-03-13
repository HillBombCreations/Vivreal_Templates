"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import type { HomeSectionProps } from "../index";
import type { ProductShowcaseItem } from "@/types/Landing";

const ProductShowcase = ({ config, siteData, prefetchedData }: HomeSectionProps) => {
  const router = useRouter();

  const items = (prefetchedData?.items as ProductShowcaseItem[]) || [];
  const sectionData = prefetchedData?.productShowcaseSection as
    | { title?: string; subtitle?: string }
    | undefined;

  const primary = siteData?.primary ?? "#1a1a2e";
  const surfaceAlt = siteData?.["surface-alt"] ?? "#f8f9fb";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dir, setDir] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0]?.clientX ?? null);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX == null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX;
    const dx = endX - touchStartX;
    setTouchStartX(null);
    if (Math.abs(dx) < 40) return;
    if (dx < 0) nextCard();
    else prevCard();
  };

  const current = useMemo(
    () => items[currentIndex],
    [items, currentIndex]
  );

  const goTo = (nextIndex: number, direction: "left" | "right") => {
    if (!items.length) return;
    setDir(direction);
    setAnimKey((k) => k + 1);
    setCurrentIndex(nextIndex);
  };

  const nextCard = () => {
    const next = (currentIndex + 1) % items.length;
    goTo(next, "right");
  };

  const prevCard = () => {
    const prev = (currentIndex - 1 + items.length) % items.length;
    goTo(prev, "left");
  };

  const onShop = () => {
    const productType = current?.["product-type"] ?? "";
    router.push(
      `/products?filter=${encodeURIComponent(productType)}&filterType=producttype`
    );
  };

  if (!current) return null;

  return (
    <section
      style={{ background: surfaceAlt }}
      className="relative overflow-hidden py-20 md:py-28"
      aria-label="Featured products"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Section header */}
        <div className="max-w-2xl mb-12 lg:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            {sectionData?.title || (config.heading as string) || "Featured"}
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-black/55 max-w-lg">
            {sectionData?.subtitle || (config.subheading as string) || "Explore our top picks"}
          </p>
        </div>

        {/* Desktop carousel */}
        <div className="hidden md:block">
          <div className="grid grid-cols-[1fr_auto] items-start gap-6">
            <div
              key={animKey}
              className={[
                "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden",
                "transition-all duration-300 ease-out",
                dir === "right" ? "animate-slideInRight" : "animate-slideInLeft",
              ].join(" ")}
            >
              <div className="grid md:grid-cols-2 min-h-[400px]">
                {/* Image half */}
                <div className="relative overflow-hidden" style={{ background: `${primary}04` }}>
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(135deg, ${primary}0a 0%, transparent 60%)`,
                    }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={current.imageUrl || "/vrlogo.png"}
                    alt={current.title}
                    className="relative w-full h-full object-contain p-8 lg:p-12"
                  />
                </div>

                {/* Text half */}
                <div className="p-8 lg:p-10 flex flex-col justify-center">
                  <span
                    className="inline-block w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4"
                    style={{ background: `${primary}0a`, color: primary }}
                  >
                    Featured
                  </span>

                  <h3 className="text-2xl lg:text-3xl font-bold tracking-tight">
                    {current.title}
                  </h3>

                  <p className="mt-3 text-sm md:text-[15px] leading-relaxed text-black/55">
                    {current.description}
                  </p>

                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={onShop}
                      className="group h-11 px-6 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                      style={{ background: primary, color: "white" }}
                    >
                      {current.buttonLabel || "Shop now"}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="flex flex-col gap-2 pt-4">
              <button
                type="button"
                onClick={prevCard}
                className="h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95"
                aria-label="Previous product"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={nextCard}
                className="h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95"
                aria-label="Next product"
              >
                <ChevronRight className="h-5 w-5" />
              </button>

              {/* Progress indicator */}
              <div className="mt-2 text-center text-xs font-medium text-black/40">
                {currentIndex + 1}/{items.length}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile carousel */}
        <div className="md:hidden">
          <div
            key={animKey}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className={[
              "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden",
              "transition-all duration-300 ease-out",
              dir === "right" ? "animate-slideInRight" : "animate-slideInLeft",
            ].join(" ")}
          >
            {/* Image */}
            <div className="relative h-[260px] sm:h-[300px] overflow-hidden" style={{ background: `${primary}04` }}>
              <div className="absolute inset-0 p-6 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.imageUrl || "/vrlogo.png"}
                  alt={current.title}
                  draggable={false}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>

            {/* Text */}
            <div className="p-5 sm:p-6">
              <h3 className="text-xl font-bold tracking-tight">
                {current.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-black/55">
                {current.description}
              </p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={onShop}
                  className="h-11 w-full cursor-pointer rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.98]"
                  style={{ background: primary, color: "white" }}
                >
                  {current.buttonLabel || "Shop now"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Dot indicators */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to item ${i + 1}`}
                onClick={() => goTo(i, i > currentIndex ? "right" : "left")}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === currentIndex ? 24 : 8,
                  background: i === currentIndex ? primary : "rgba(0,0,0,0.12)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-24px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideInRight {
          animation: slideInRight 300ms ease-out;
        }
        .animate-slideInLeft {
          animation: slideInLeft 300ms ease-out;
        }
      `}</style>
    </section>
  );
};

export default ProductShowcase;
