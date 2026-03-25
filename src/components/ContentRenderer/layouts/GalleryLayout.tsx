"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import ItemLink from "../ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  const heights = [240, 320, 200, 280, 220, 300, 260, 180];
  return (
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
      {heights.map((h, i) => (
        <div
          key={i}
          className="break-inside-avoid rounded-2xl overflow-hidden animate-pulse bg-black/[0.04]"
          style={{ height: h }}
        />
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
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
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
/*  Gallery Layout — CSS-columns masonry                               */
/* ------------------------------------------------------------------ */

export default function GalleryLayout({
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
    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
      {items.map((item) => (
        <ItemLink
          key={item.id}
          href={`/${slug}/${encodeURIComponent(item.id)}`}
          enabled={detailEnabled}
          className={`group break-inside-avoid block rounded-2xl overflow-hidden relative ${
            detailEnabled ? "cursor-pointer" : ""
          }`}
        >
          {item.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-auto block transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />

              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex flex-col justify-end p-4 sm:p-5">
                {/* Content fades in on hover */}
                <div className="translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <h3 className="font-semibold text-sm sm:text-base text-white leading-snug line-clamp-2 drop-shadow-sm">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-1.5 text-xs sm:text-sm text-white/75 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                  {item.price && (
                    <span className="mt-2 inline-block text-sm font-bold text-white drop-shadow-sm">
                      {item.price}
                    </span>
                  )}
                </div>
              </div>

              {/* Tags — always visible, top-left */}
              {item.tags && item.tags.length > 0 && (
                <div className="absolute top-3 left-3 flex gap-1">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm"
                    style={{
                      background: `color-mix(in srgb, ${primary} 85%, white)`,
                      color: "white",
                    }}
                  >
                    {item.tags[0]}
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Fallback when no image — show as a styled card */
            <div
              className="p-6 sm:p-7 min-h-[180px] flex flex-col justify-end"
              style={{
                background: `color-mix(in srgb, ${primary} 4%, white)`,
              }}
            >
              <h3 className="font-semibold text-sm sm:text-base leading-snug line-clamp-2">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 text-xs sm:text-sm text-black/45 line-clamp-3 leading-relaxed">
                  {item.description}
                </p>
              )}
              {item.tags && item.tags.length > 0 && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
                  {item.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
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
          )}
        </ItemLink>
      ))}
    </div>
  );
}
