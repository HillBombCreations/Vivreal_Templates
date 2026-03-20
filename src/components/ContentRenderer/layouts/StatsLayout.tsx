"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[0.06] bg-white p-6 text-center animate-pulse"
        >
          <div className="mx-auto h-12 w-12 rounded-full bg-black/[0.04] mb-3" />
          <div className="mx-auto h-8 w-16 rounded-lg bg-black/[0.06] mb-2" />
          <div className="mx-auto h-4 w-20 rounded-lg bg-black/[0.04]" />
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
        {message || "No stats to display yet."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats Layout                                                       */
/* ------------------------------------------------------------------ */

/**
 * Extracts a numeric display value from a ContentItem.
 * Tries item.price first, then looks for numeric-looking raw fields.
 */
function getStatValue(item: { price?: string; raw?: Record<string, unknown> }): string {
  if (item.price) return item.price;

  if (item.raw) {
    for (const val of Object.values(item.raw)) {
      if (typeof val === "number") return val.toLocaleString();
      if (typeof val === "string" && /^\d[\d,]*$/.test(val.trim())) return val;
    }
  }

  return "--";
}

export default function StatsLayout({
  items,
  accent,
  loading,
  emptyMessage,
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  const primary = accent || "var(--primary)";

  // Responsive column count: up to 4 columns for 4+ items
  const colClass =
    items.length === 1
      ? "grid-cols-1 max-w-xs mx-auto"
      : items.length === 2
        ? "grid-cols-2 max-w-lg mx-auto"
        : items.length === 3
          ? "grid-cols-3"
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid gap-5 ${colClass}`}>
      {items.map((item) => {
        const value = getStatValue(item);

        return (
          <div
            key={item.id}
            className="flex flex-col items-center text-center p-6 rounded-2xl border border-black/[0.06] bg-white transition-all duration-300 hover:shadow-md"
          >
            {/* Icon circle */}
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center mb-3 overflow-hidden"
              style={{ background: `color-mix(in srgb, ${primary} 10%, transparent)` }}
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

            {/* Stat value */}
            <span
              className="text-2xl md:text-3xl font-bold"
              style={{ color: primary }}
            >
              {value}
            </span>

            {/* Label */}
            <span className="text-sm text-black/50 mt-1">
              {item.title}
            </span>

            {/* Description (optional) */}
            {item.description && (
              <p className="mt-2 text-xs text-black/40 leading-relaxed line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
