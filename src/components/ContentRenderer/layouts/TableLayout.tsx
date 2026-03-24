"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import ItemLink from "../ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      {/* Desktop header */}
      <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-3 border-b border-black/[0.04] bg-black/[0.015]">
        {["Title", "Description", "Date", "Price"].map((h) => (
          <div key={h} className="h-4 w-16 rounded bg-black/[0.06]" />
        ))}
      </div>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse border-b border-black/[0.04] last:border-b-0"
        >
          {/* Desktop */}
          <div className="hidden md:grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-4">
            <div className="h-4 w-3/4 rounded bg-black/[0.05]" />
            <div className="space-y-1.5">
              <div className="h-4 w-full rounded bg-black/[0.04]" />
              <div className="h-4 w-2/3 rounded bg-black/[0.04]" />
            </div>
            <div className="h-4 w-20 rounded bg-black/[0.04]" />
            <div className="h-4 w-14 rounded bg-black/[0.05]" />
          </div>
          {/* Mobile */}
          <div className="md:hidden p-4">
            <div className="h-4 w-2/3 rounded bg-black/[0.05]" />
            <div className="mt-2 h-4 w-full rounded bg-black/[0.04]" />
            <div className="mt-3 flex gap-4">
              <div className="h-3 w-16 rounded bg-black/[0.04]" />
              <div className="h-3 w-12 rounded bg-black/[0.05]" />
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
    <div className="rounded-2xl border border-black/[0.06] bg-white p-12 text-center">
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
            d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M12 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M3.375 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5"
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
/*  Table Layout                                                       */
/* ------------------------------------------------------------------ */

export default function TableLayout({
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
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
      {/* Desktop table */}
      <div className="hidden md:block">
        {/* Header */}
        <div className="grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-3 border-b border-black/[0.06] bg-black/[0.015]">
          <span className="text-xs font-semibold uppercase tracking-wider text-black/40">
            Title
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-black/40">
            Description
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-black/40">
            Date
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-black/40 text-right">
            Price
          </span>
        </div>

        {/* Rows */}
        {items.map((item) => (
          <ItemLink
            key={item.id}
            href={`/${slug}/${encodeURIComponent(item.id)}`}
            enabled={detailEnabled}
            className={`grid grid-cols-[1fr_2fr_1fr_1fr] gap-4 px-6 py-4 border-b border-black/[0.04] last:border-b-0 transition-colors duration-150 hover:bg-black/[0.015] ${
              detailEnabled ? "cursor-pointer" : ""
            }`}
          >
            {/* Title cell */}
            <div className="flex items-center gap-3 min-w-0">
              {item.imageUrl && (
                <div className="h-9 w-9 shrink-0 rounded-lg overflow-hidden bg-black/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-sm font-semibold leading-snug line-clamp-1">
                  {item.title}
                </span>
                {item.tags && item.tags.length > 0 && (
                  <div className="mt-0.5 flex gap-1">
                    {item.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-1.5 py-px text-[10px] font-medium"
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
            </div>

            {/* Description cell */}
            <span className="text-sm text-black/50 leading-relaxed line-clamp-2 self-center">
              {item.description || "\u2014"}
            </span>

            {/* Date cell */}
            <span className="text-sm text-black/40 self-center">
              {item.date || "\u2014"}
            </span>

            {/* Price cell */}
            <span
              className="text-sm font-bold self-center text-right"
              style={{ color: item.price ? primary : undefined }}
            >
              {item.price || "\u2014"}
            </span>
          </ItemLink>
        ))}
      </div>

      {/* Mobile stacked cards */}
      <div className="md:hidden divide-y divide-black/[0.04]">
        {items.map((item) => (
          <ItemLink
            key={item.id}
            href={`/${slug}/${encodeURIComponent(item.id)}`}
            enabled={detailEnabled}
            className={`block p-4 transition-colors duration-150 hover:bg-black/[0.015] ${
              detailEnabled ? "cursor-pointer" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              {item.imageUrl && (
                <div className="h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-black/[0.03]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold leading-snug line-clamp-1">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-1 text-xs text-black/45 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-xs text-black/35">
                  {item.date && <span>{item.date}</span>}
                  {item.price && (
                    <span className="font-bold" style={{ color: primary }}>
                      {item.price}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </ItemLink>
        ))}
      </div>
    </div>
  );
}
