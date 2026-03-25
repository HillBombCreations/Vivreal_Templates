"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import ItemLink from "../ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden animate-pulse"
        >
          <div className="h-[280px] sm:h-[340px] bg-black/[0.04]" />
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-4 w-24 rounded-full bg-black/[0.06]" />
            </div>
            <div className="h-6 w-3/4 rounded-lg bg-black/[0.06]" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
              <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
              <div className="h-4 w-2/3 rounded-lg bg-black/[0.04]" />
            </div>
            <div className="mt-5 flex gap-2">
              <div className="h-6 w-16 rounded-full bg-black/[0.04]" />
              <div className="h-6 w-16 rounded-full bg-black/[0.04]" />
            </div>
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
    <div className="mx-auto max-w-2xl rounded-2xl border border-black/[0.06] bg-white p-12 text-center">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-black/[0.03] flex items-center justify-center">
        <svg
          className="h-6 w-6 text-black/20"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-black/40">
        {message || "Nothing to display yet."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed Layout — vertical social-style feed                           */
/* ------------------------------------------------------------------ */

export default function FeedLayout({
  items,
  slug,
  detailEnabled,
  accent,
  loading,
  emptyMessage,
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  const primary = accent || "var(--primary)";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {items.map((item) => (
        <ItemLink
          key={item.id}
          href={`/${slug}/${encodeURIComponent(item.id)}`}
          enabled={detailEnabled}
          className={`group block rounded-2xl border border-black/[0.06] bg-white overflow-hidden transition-all duration-300 hover:shadow-lg ${
            detailEnabled ? "cursor-pointer" : ""
          }`}
        >
          {/* Image — large, prominent */}
          {item.imageUrl && (
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-auto max-h-[400px] object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                loading="lazy"
              />
            </div>
          )}

          {/* Body */}
          <div className="p-6 sm:p-8">
            {/* Meta line */}
            <div className="flex items-center gap-3 text-xs text-black/40 mb-3">
              {item.date && (
                <time className="font-medium">{item.date}</time>
              )}
              {item.source === "integration" && item.integrationType && (
                <>
                  <span className="h-1 w-1 rounded-full bg-black/20" />
                  <span className="capitalize">{item.integrationType}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight leading-snug">
              {item.title}
            </h3>

            {/* Full description — no clamp */}
            {item.description && (
              <p className="mt-3 text-[15px] text-black/55 leading-relaxed whitespace-pre-line">
                {item.description}
              </p>
            )}

            {/* Price */}
            {item.price && (
              <div
                className="mt-4 text-xl font-bold"
                style={{ color: primary }}
              >
                {item.price}
              </div>
            )}

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <div className="mt-5 flex gap-2 flex-wrap">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200"
                    style={{
                      background: `color-mix(in srgb, ${primary} 7%, transparent)`,
                      color: primary,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Read more hint when detail is enabled */}
            {detailEnabled && (
              <div
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ color: primary }}
              >
                Read more
                <svg
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </div>
            )}
          </div>
        </ItemLink>
      ))}
    </div>
  );
}
