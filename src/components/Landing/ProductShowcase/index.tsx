"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { ProductShowcase } from "@/types/Landing";

type ProductShowcaseSection = {
  title: string;
  subtitle: string;
};

type ProductShowcaseProps = {
  productShowcase: ProductShowcase[];
  productShowcaseSection: ProductShowcaseSection;
};

export default function ProductShowcaseComponent({
  productShowcase,
  productShowcaseSection,
}: ProductShowcaseProps) {
  const router = useRouter();
  const siteData = useSiteData();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surfaceAlt = siteData?.siteDetails?.["surface-alt"] ?? "var(--surface,#ffffff)";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [dir, setDir] = useState<"left" | "right">("right");
  const [animKey, setAnimKey] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
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

    if (showSwipeHint) {
      setShowSwipeHint(false);
      try { sessionStorage.setItem("ps_swipe_hint_seen", "1"); } catch {}
    }

    if (dx < 0) nextCard();
    else prevCard();
  };

  const current = useMemo(
    () => productShowcase?.[currentIndex],
    [productShowcase, currentIndex]
  );

  const goTo = (nextIndex: number, direction: "left" | "right") => {
    if (!productShowcase?.length) return;
    setDir(direction);
    setAnimKey((k) => k + 1);
    setCurrentIndex(nextIndex);
  };

  const nextCard = () => {
    const next = (currentIndex + 1) % productShowcase.length;
    goTo(next, "right");
  };

  const prevCard = () => {
    const prev =
      (currentIndex - 1 + productShowcase.length) % productShowcase.length;
    goTo(prev, "left");
  };

  const onShop = () => {
    const productType = current?.productType ?? "";
    router.push(`/products?filter=${encodeURIComponent(productType)}`);
  };


  if (!current) return null;

  return (
  <section
    style={{ background: surfaceAlt }}
    className={`
      relative overflow-hidden
      min-h-[100svh]
      py-10 md:py-16
      flex items-stretch
    `}
    aria-label="Explore products"
  >
    <div
      className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl opacity-20"
      style={{
        background: `radial-gradient(circle at center, ${primary} 0%, transparent 70%)`,
      }}
    />

    <div className="w-full flex items-center">
      <div className="mx-5 md:mx-20 lg:mx-40 w-full">
        <div
          className={`
             grid items-center gap-10 lg:grid-cols-12
                min-h-[calc(100svh-5rem)]
                md:min-h-[calc(100svh-8rem)]
            `}
        >
          <div className="order-2 lg:order-1 lg:col-span-5 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {productShowcaseSection.title}
            </h2>
            <p className="mt-3 text-sm md:text-base leading-relaxed text-black/60 max-w-lg mx-auto lg:mx-0">
              {productShowcaseSection.subtitle}
            </p>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-7">
            <div className="hidden md:grid grid-cols-[44px_1fr_44px] items-center gap-4">
              <button
                type="button"
                onClick={prevCard}
                className="h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border bg-white/70 shadow-sm backdrop-blur transition active:scale-[0.99]"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
                aria-label="Previous"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <div
                key={animKey}
                className={[
                  "rounded-3xl border bg-white/70 backdrop-blur shadow-sm overflow-hidden",
                  "transition-transform duration-300 ease-out",
                  "h-[420px] md:h-[480px] lg:h-[520px]",
                  dir === "right" ? "animate-slideInRight" : "animate-slideInLeft",
                ].join(" ")}
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                <div className="grid md:grid-cols-2 gap-0 h-full">
                  <div className="relative p-5 md:p-7 flex items-center justify-center h-full overflow-hidden">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-30"
                      style={{
                        background: `linear-gradient(135deg, ${primary}22 0%, transparent 55%)`,
                      }}
                    />
                    <img
                      src={current.imageUrl || "/heroImage.png"}
                      alt={current.title}
                      width={900}
                      height={700}
                      className="relative w-full h-full object-contain max-h-full"
                    />
                  </div>
                  <div className="p-5 md:p-7 flex flex-col h-full">
                    <div className="flex-1 flex flex-col justify-center">
                      <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
                        {current.title}
                      </h3>
                      <p className="mt-2 text-sm md:text-[15px] leading-relaxed text-black/60">
                        {current.description}
                      </p>
                    </div>
                    <div className="pt-6 flex flex-col sm:flex-row gap-3">
                      <button
                        type="button"
                        onClick={onShop}
                        className="h-11 px-5 cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
                        style={{ background: primary, color: "white" }}
                      >
                        {current.buttonLabel}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={nextCard}
                className="h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border bg-white/70 shadow-sm backdrop-blur transition active:scale-[0.99]"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
                aria-label="Next"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="md:hidden">
              <div
                key={animKey}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                className={[
                  "rounded-3xl border bg-white/70 backdrop-blur shadow-sm overflow-hidden",
                  "transition-transform duration-300 ease-out",
                  dir === "right" ? "animate-slideInRight" : "animate-slideInLeft",
                ].join(" ")}
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                <div className="relative h-[240px] sm:h-[280px] overflow-hidden bg-white">
                  <div
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      background: `linear-gradient(135deg, ${primary}22 0%, transparent 55%)`,
                    }}
                  />
                  <div className="absolute inset-0 p-3 flex items-center justify-center">
                    <img
                      src={current.imageUrl || "/heroImage.png"}
                      alt={current.title}
                      width={900}
                      height={700}
                      draggable={false}
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {current.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-black/60">
                    {current.description}
                  </p>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={onShop}
                      className="h-11 w-full px-5 cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
                      style={{ background: primary, color: "white" }}
                    >
                      {current.buttonLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>

                    <div className="mt-4 flex items-center justify-center gap-2">
                      {productShowcase.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          aria-label={`Go to item ${i + 1}`}
                          onClick={() => goTo(i, i > currentIndex ? "right" : "left")}
                          className="h-2.5 rounded-full transition-all"
                          style={{
                            width: i === currentIndex ? 18 : 8,
                            background: i === currentIndex ? primary : "rgba(0,0,0,0.12)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {showSwipeHint ? (
                <div className="mt-3 flex justify-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 backdrop-blur px-3 py-1 text-[11px] font-semibold text-black/70 shadow-sm animate-[fadeUp_2200ms_ease-out_forwards]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: primary }} />
                    Swipe to browse
                  </div>
                </div>
              ) : null}
            </div>

            <style jsx>{`
              @keyframes fadeUp {
                0% { opacity: 0; transform: translateY(8px); }
                10% { opacity: 1; transform: translateY(0); }
                80% { opacity: 1; transform: translateY(0); }
                100% { opacity: 0; transform: translateY(-6px); }
              }
              @keyframes slideInRight {
                from {
                  opacity: 0;
                  transform: translateX(20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              @keyframes slideInLeft {
                from {
                  opacity: 0;
                  transform: translateX(-20px);
                }
                to {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              .animate-slideInRight {
                animation: slideInRight 260ms ease-out;
              }
              .animate-slideInLeft {
                animation: slideInLeft 260ms ease-out;
              }
            `}</style>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}