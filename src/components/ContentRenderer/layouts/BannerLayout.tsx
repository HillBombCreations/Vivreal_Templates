"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="min-h-[60vh] overflow-hidden animate-pulse bg-black/[0.04]">
      <div className="content-grid">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[60vh] py-16">
          <div className="space-y-4">
            <div className="h-10 w-3/4 rounded-lg bg-black/[0.06]" />
            <div className="h-6 w-full rounded-lg bg-black/[0.04]" />
            <div className="h-6 w-2/3 rounded-lg bg-black/[0.04]" />
            <div className="mt-4 h-12 w-40 rounded-full bg-black/[0.06]" />
          </div>
          <div className="h-80 rounded-2xl bg-black/[0.06]" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function Empty({ accent }: { accent: string }) {
  return (
    <div
      className="min-h-[40vh] overflow-hidden flex items-center justify-center"
      style={{ background: `color-mix(in srgb, ${accent} 8%, white)` }}
    >
      <div className="text-center px-8">
        <h2
          className="text-3xl md:text-4xl font-bold tracking-tight"
          style={{ color: accent }}
        >
          Welcome
        </h2>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Banner Layout — split: text left, image right                      */
/* ------------------------------------------------------------------ */

export default function BannerLayout({
  items,
  accent,
  loading,
  pageLabels,
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;

  const primary = accent || "var(--primary)";
  const labels = pageLabels ?? {};

  const heroTitle = (labels.title as string) || items[0]?.title || "Welcome";
  const heroSubtitle = (labels.subtitle as string) || items[0]?.description;
  const heroImage = (labels.heroImageUrl as string) || items[0]?.imageUrl;
  const buttonLabel = (labels.buttonLabel as string) || items[0]?.tags?.[0];
  const buttonLink = (labels.buttonLink as string) || items[0]?.href;

  if (!heroTitle && !items.length) return <Empty accent={primary} />;

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 6%, white), color-mix(in srgb, ${primary} 12%, white))`,
      }}
    >
      {/* Decorative blurs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
        style={{ background: primary }}
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10"
        style={{ background: primary }}
      />

      <div className="content-grid relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[60vh] md:min-h-[70vh] py-16 md:py-20">
          {/* Left — text + CTA */}
          <div className="flex flex-col justify-center order-2 lg:order-1">
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
              style={{ color: "var(--text-primary, #111)" }}
            >
              {heroTitle}
            </h1>

            {heroSubtitle && (
              <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-lg" style={{ color: "var(--text-secondary, #555)" }}>
                {heroSubtitle}
              </p>
            )}

            {buttonLabel && buttonLink && (
              <div className="mt-8">
                <a
                  href={buttonLink}
                  className="group inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] text-white"
                  style={{ background: primary }}
                >
                  {buttonLabel}
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-8 flex items-center gap-5 text-xs" style={{ color: "var(--text-secondary, #555)" }}>
              <span className="flex items-center gap-1.5 opacity-60">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Quality Guaranteed
              </span>
              <span className="flex items-center gap-1.5 opacity-60">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                Made with Care
              </span>
              <span className="flex items-center gap-1.5 opacity-60">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25V3.375c0-.621.504-1.125 1.125-1.125h14.25c.621 0 1.125.504 1.125 1.125v11.25" />
                </svg>
                Local Pickup
              </span>
            </div>
          </div>

          {/* Right — hero image */}
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            {heroImage ? (
              <div className="relative w-full max-w-md lg:max-w-lg">
                <div
                  className="absolute inset-0 rounded-3xl blur-2xl opacity-20 scale-95"
                  style={{ background: primary }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={heroImage}
                  alt={heroTitle}
                  className="relative w-full h-auto rounded-3xl shadow-2xl object-cover"
                  loading="eager"
                />
              </div>
            ) : (
              <div
                className="w-full max-w-md lg:max-w-lg aspect-[4/3] rounded-3xl"
                style={{ background: `color-mix(in srgb, ${primary} 15%, white)` }}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
