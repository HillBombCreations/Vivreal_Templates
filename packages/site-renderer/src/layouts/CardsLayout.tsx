"use client";

import type { ContentLayoutProps } from "../types/ContentItem";
import ItemLink from "../components/ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden flex flex-col animate-pulse"
        >
          <div className="h-[200px] w-full bg-black/[0.04]" />
          <div className="p-5 flex flex-col flex-1 min-h-0">
            <div className="h-5 w-3/4 rounded-lg bg-black/[0.06]" />
            <div className="mt-3 space-y-2">
              <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
              <div className="h-4 w-[70%] rounded-lg bg-black/[0.04]" />
            </div>
            <div className="mt-auto pt-5 flex items-center justify-between">
              <div className="h-5 w-16 rounded-lg bg-black/[0.06]" />
              <div className="flex gap-1.5">
                <div className="h-6 w-14 rounded-full bg-black/[0.04]" />
                <div className="h-6 w-14 rounded-full bg-black/[0.04]" />
              </div>
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
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 11.625l2.25-2.25M12 11.625l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
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
/*  Cards Layout                                                       */
/* ------------------------------------------------------------------ */

export default function CardsLayout({
  items,
  slug,
  detailEnabled,
  accent,
  loading,
  emptyMessage,
  LinkComponent,
}: ContentLayoutProps) {
  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  const primary = accent || "var(--primary)";

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemLink
          key={item.id}
          href={`/${slug}/${encodeURIComponent(item.id)}`}
          enabled={detailEnabled}
          LinkComponent={LinkComponent}
          className={`group rounded-2xl border border-black/[0.06] bg-white overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
            detailEnabled ? "cursor-pointer" : ""
          }`}
        >
          {/* Image */}
          {item.imageUrl ? (
            <div className="relative h-[200px] overflow-hidden bg-black/[0.02]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="h-[200px] bg-black/[0.03] flex items-center justify-center">
              <svg
                className="h-10 w-10 text-black/10"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
          )}

          {/* Body */}
          <div className="p-5 flex flex-col flex-1 min-h-[140px]">
            <h3 className="font-semibold text-[15px] leading-snug line-clamp-2">
              {item.title}
            </h3>

            {item.description && (
              <p className="mt-2 text-sm leading-relaxed text-black/50 line-clamp-2">
                {item.description}
              </p>
            )}

            <div className="mt-auto pt-4 flex items-center justify-between gap-3">
              {item.price && (
                <span
                  className="text-lg font-bold"
                  style={{ color: primary }}
                >
                  {item.price}
                </span>
              )}

              {item.tags && item.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {item.tags.slice(0, 2).map((tag) => (
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
                  {item.tags.length > 2 && (
                    <span className="text-[11px] font-medium text-black/30">
                      +{item.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </ItemLink>
      ))}
    </div>
  );
}
