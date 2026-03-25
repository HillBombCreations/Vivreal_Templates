"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import ItemLink from "../ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl overflow-hidden animate-pulse aspect-square bg-black/[0.04]"
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
/*  Grid Layout — dense, image-dominant                                */
/* ------------------------------------------------------------------ */

export default function GridLayout({
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {items.map((item) => (
        <ItemLink
          key={item.id}
          href={`/${slug}/${encodeURIComponent(item.id)}`}
          enabled={detailEnabled}
          className={`group relative rounded-2xl overflow-hidden aspect-square ${
            detailEnabled ? "cursor-pointer" : ""
          }`}
        >
          {/* Image fill */}
          {item.imageUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              {/* Permanent subtle gradient for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent" />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `color-mix(in srgb, ${primary} 6%, white)`,
              }}
            />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />

          {/* Title overlay */}
          <div className="absolute inset-x-0 bottom-0 p-4 translate-y-1 group-hover:translate-y-0 transition-transform duration-300">
            <h3 className="font-semibold text-sm leading-snug text-white drop-shadow-sm line-clamp-2">
              {item.title}
            </h3>
            {item.price && (
              <span className="mt-1 inline-block text-xs font-bold text-white/90 drop-shadow-sm">
                {item.price}
              </span>
            )}
          </div>

          {/* Tags — top-right corner */}
          {item.tags && item.tags.length > 0 && (
            <div className="absolute top-3 right-3 flex gap-1">
              <span className="rounded-full bg-white/90 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-black/70 shadow-sm">
                {item.tags[0]}
              </span>
            </div>
          )}
        </ItemLink>
      ))}
    </div>
  );
}
