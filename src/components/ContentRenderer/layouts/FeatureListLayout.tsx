"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[0.06] bg-white p-6 animate-pulse"
        >
          <div className="h-12 w-12 rounded-xl bg-black/[0.04] mb-4" />
          <div className="h-5 w-2/3 rounded-lg bg-black/[0.06]" />
          <div className="mt-3 space-y-2">
            <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
            <div className="h-4 w-3/4 rounded-lg bg-black/[0.04]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

function Empty({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-12 text-center">
      <p className="text-sm font-medium text-black/40">
        {message || "No features to display yet."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature List Layout                                                */
/* ------------------------------------------------------------------ */

export default function FeatureListLayout({
  items,
  accent,
  loading,
  emptyMessage,
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  const primary = accent || "var(--primary)";

  return (
    <div
      className="rounded-3xl py-14 md:py-20 px-6 md:px-10"
      style={{ background: `color-mix(in srgb, ${primary} 5%, white)` }}
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl bg-white p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
          >
            {/* Icon or image */}
            <div
              className="h-48 md:h-56 w-full rounded-2xl flex items-center justify-center mb-5 overflow-hidden"
              style={{ background: `color-mix(in srgb, ${primary} 6%, transparent)` }}
            >
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-contain p-2"
                  loading="lazy"
                />
              ) : (
                <span
                  className="text-xl font-bold"
                  style={{ color: primary }}
                >
                  {item.title.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-semibold tracking-tight">
              {item.title}
            </h3>

            {/* Description */}
            {item.description && (
              <p className="mt-2.5 text-sm leading-relaxed text-black/55">
                {item.description}
              </p>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-5 flex gap-1.5 flex-wrap">
                {item.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{
                      background: `color-mix(in srgb, ${primary} 10%, transparent)`,
                      color: primary,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
