"use client";

import type { ContentLayoutProps } from "@/types/ContentItem";
import ItemLink from "../ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="relative pl-8 sm:pl-0">
      {/* Vertical line */}
      <div className="absolute left-3 sm:left-1/2 top-0 bottom-0 w-px bg-black/[0.08]" />

      <div className="space-y-10">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="relative sm:grid sm:grid-cols-2 sm:gap-8">
            {/* Dot */}
            <div className="absolute left-3 sm:left-1/2 top-4 -translate-x-1/2 h-3 w-3 rounded-full bg-black/[0.08] ring-4 ring-white" />
            <div
              className={`animate-pulse ${
                i % 2 === 0 ? "sm:pr-8" : "sm:col-start-2 sm:pl-8"
              }`}
            >
              <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
                <div className="h-4 w-20 rounded-full bg-black/[0.06] mb-3" />
                <div className="h-5 w-3/4 rounded-lg bg-black/[0.06]" />
                <div className="mt-3 space-y-1.5">
                  <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
                  <div className="h-4 w-2/3 rounded-lg bg-black/[0.04]" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
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
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
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
/*  Timeline Layout                                                    */
/* ------------------------------------------------------------------ */

export default function TimelineLayout({
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
    <div className="relative pl-8 sm:pl-0">
      {/* Vertical line */}
      <div
        className="absolute left-3 sm:left-1/2 top-0 bottom-0 w-px"
        style={{
          background: `color-mix(in srgb, ${primary} 15%, transparent)`,
        }}
      />

      <div className="space-y-8 sm:space-y-12">
        {items.map((item, i) => {
          const isLeft = i % 2 === 0;

          return (
            <div
              key={item.id}
              className="relative sm:grid sm:grid-cols-2 sm:gap-8"
            >
              {/* Center dot */}
              <div
                className="absolute left-3 sm:left-1/2 top-5 -translate-x-1/2 h-3.5 w-3.5 rounded-full ring-4 ring-white z-10 transition-transform duration-300 hover:scale-125"
                style={{ background: primary }}
              />

              {/* Connector line to card — desktop only */}
              <div
                className="hidden sm:block absolute top-[1.45rem] h-px w-8"
                style={{
                  background: `color-mix(in srgb, ${primary} 15%, transparent)`,
                  ...(isLeft
                    ? { right: "50%", marginRight: 7 }
                    : { left: "50%", marginLeft: 7 }),
                }}
              />

              {/* Card — placed in correct column */}
              <div
                className={
                  isLeft
                    ? "sm:pr-8 sm:text-right"
                    : "sm:col-start-2 sm:pl-8"
                }
              >
                <ItemLink
                  href={`/${slug}/${encodeURIComponent(item.id)}`}
                  enabled={detailEnabled}
                  className={`group rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 block ${
                    detailEnabled ? "cursor-pointer" : ""
                  }`}
                >
                  {/* Date badge */}
                  {item.date && (
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-3"
                      style={{
                        background: `color-mix(in srgb, ${primary} 8%, transparent)`,
                        color: primary,
                      }}
                    >
                      {item.date}
                    </span>
                  )}

                  {/* Image */}
                  {item.imageUrl && (
                    <div className="relative h-[140px] sm:h-[160px] rounded-xl overflow-hidden mb-4 bg-black/[0.02]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}

                  <h3
                    className={`font-semibold text-[15px] sm:text-base leading-snug ${
                      isLeft ? "sm:text-right" : ""
                    }`}
                  >
                    {item.title}
                  </h3>

                  {item.description && (
                    <p
                      className={`mt-2 text-sm text-black/50 leading-relaxed line-clamp-3 ${
                        isLeft ? "sm:text-right" : ""
                      }`}
                    >
                      {item.description}
                    </p>
                  )}

                  {item.tags && item.tags.length > 0 && (
                    <div
                      className={`mt-3 flex gap-1.5 flex-wrap ${
                        isLeft ? "sm:justify-end" : ""
                      }`}
                    >
                      {item.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-black/[0.04] text-black/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </ItemLink>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
