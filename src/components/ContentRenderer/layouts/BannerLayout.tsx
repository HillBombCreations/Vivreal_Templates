"use client";

import { ArrowRight } from "lucide-react";
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
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;

  const primary = accent || "var(--primary)";

  if (!items.length) return <Empty accent={primary} />;

  const item = items[0];
  const hasImage = !!item.imageUrl;

  return (
    <section className="relative min-h-[60vh] md:min-h-[70vh] overflow-hidden">
      {/* Background image */}
      {hasImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        </>
      )}

      {/* Fallback gradient when no image */}
      {!hasImage && (
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
          {item.title}
        </h1>

        {item.description && (
          <p className="mt-5 text-base sm:text-lg text-white/80 max-w-xl leading-relaxed">
            {item.description}
          </p>
        )}

        {item.href && (
          <a
            href={item.href}
            className="mt-8 group inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] bg-white"
            style={{ color: primary }}
          >
            Learn more
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </a>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="mt-6 flex gap-2 flex-wrap justify-center">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-3 py-1 text-xs font-medium bg-white/20 text-white backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
