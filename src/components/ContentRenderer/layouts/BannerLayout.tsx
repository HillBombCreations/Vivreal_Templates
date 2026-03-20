"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="relative min-h-[60vh] overflow-hidden animate-pulse bg-black/[0.04]">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
        <div className="h-8 w-2/3 max-w-md rounded-lg bg-black/[0.06]" />
        <div className="mt-4 h-5 w-1/2 max-w-sm rounded-lg bg-black/[0.04]" />
        <div className="mt-8 h-12 w-40 rounded-full bg-black/[0.06]" />
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
      className="relative min-h-[40vh] overflow-hidden flex items-center justify-center"
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
/*  Banner Layout                                                      */
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

  // Prefer page labels for hero content, fall back to first item
  const heroTitle = (labels.title as string) || items[0]?.title || "Welcome";
  const heroSubtitle = (labels.subtitle as string) || items[0]?.description;
  const heroImage = (labels.heroImage as { key?: string })?.key
    ? (labels.heroImageUrl as string) // signed URL would be here
    : items[0]?.imageUrl;
  const buttonLabel = (labels.buttonLabel as string) || items[0]?.tags?.[0];
  const buttonLink = (labels.buttonLink as string) || items[0]?.href;

  if (!heroTitle && !items.length) return <Empty accent={primary} />;

  return (
    <section className="relative min-h-[60vh] md:min-h-[70vh] overflow-hidden">
      {/* Background image */}
      {heroImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage}
            alt={heroTitle}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        </>
      )}

      {/* Fallback gradient when no image */}
      {!heroImage && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${primary}, color-mix(in srgb, ${primary} 60%, black))`,
          }}
        />
      )}

      {/* Content overlay */}
      <div className="relative flex flex-col items-center justify-center min-h-[60vh] md:min-h-[70vh] px-6 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white max-w-3xl leading-[1.1]">
          {heroTitle}
        </h1>

        {heroSubtitle && (
          <p className="mt-5 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed">
            {heroSubtitle}
          </p>
        )}

        {buttonLabel && buttonLink && (
          <a
            href={buttonLink}
            className="mt-8 group inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] bg-white"
            style={{ color: primary }}
          >
            {buttonLabel}
            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        )}

        {/* Trust indicators */}
        <div className="mt-10 flex items-center gap-6 text-white/50 text-xs">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            Quality Guaranteed
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
            Made with Care
          </span>
        </div>
      </div>
    </section>
  );
}
