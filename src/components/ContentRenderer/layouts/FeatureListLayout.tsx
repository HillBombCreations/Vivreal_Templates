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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-black/[0.06] bg-white p-6 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          {/* Icon or image */}
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 overflow-hidden"
            style={{ background: `color-mix(in srgb, ${primary} 8%, transparent)` }}
          >
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <span
                className="text-lg font-bold"
                style={{ color: primary }}
              >
                {item.title.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-semibold tracking-tight">
            {item.title}
          </h3>

          {/* Description */}
          {item.description && (
            <p className="mt-2 text-sm leading-relaxed text-black/50 line-clamp-3">
              {item.description}
            </p>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-4 flex gap-1.5 flex-wrap">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${primary} 8%, transparent)`,
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
  );
}
