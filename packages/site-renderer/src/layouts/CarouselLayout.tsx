"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ContentLayoutProps } from "../types/ContentItem";
import ItemLink from "../components/ItemLink";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="relative">
      <div className="flex gap-4 overflow-hidden px-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[280px] sm:w-[320px] rounded-2xl border border-black/[0.06] bg-white overflow-hidden animate-pulse"
          >
            <div className="h-[180px] bg-black/[0.04]" />
            <div className="p-5">
              <div className="h-5 w-3/4 rounded-lg bg-black/[0.06]" />
              <div className="mt-3 h-4 w-full rounded-lg bg-black/[0.04]" />
              <div className="mt-1.5 h-4 w-2/3 rounded-lg bg-black/[0.04]" />
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
            d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-1.014.671-1.872 1.593-2.152"
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
/*  Carousel Layout                                                    */
/* ------------------------------------------------------------------ */

export default function CarouselLayout({
  items,
  slug,
  detailEnabled,
  accent,
  loading,
  emptyMessage,
  LinkComponent,
}: ContentLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, items]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  const primary = accent || "var(--primary)";

  return (
    <div className="relative group/carousel">
      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 -mb-4 scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Leading spacer for edge peek */}
        <div className="shrink-0 w-1 sm:w-0" />

        {items.map((item) => (
          <ItemLink
            key={item.id}
            href={`/${slug}/${encodeURIComponent(item.id)}`}
            enabled={detailEnabled}
            LinkComponent={LinkComponent}
            className={`group shrink-0 snap-start w-[280px] sm:w-[320px] lg:w-[340px] rounded-2xl border border-black/[0.06] bg-white overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
              detailEnabled ? "cursor-pointer" : ""
            }`}
          >
            {/* Image */}
            {item.imageUrl ? (
              <div className="relative h-[180px] overflow-hidden bg-black/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="h-[180px] bg-black/[0.03] flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-black/10"
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
            <div className="p-5">
              <h3 className="font-semibold text-[15px] leading-snug line-clamp-2">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 text-sm text-black/50 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between gap-3">
                {item.price && (
                  <span
                    className="text-lg font-bold"
                    style={{ color: primary }}
                  >
                    {item.price}
                  </span>
                )}
                {item.date && (
                  <span className="text-xs text-black/35">{item.date}</span>
                )}
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="mt-3 flex gap-1.5 flex-wrap">
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
          </ItemLink>
        ))}

        {/* Trailing spacer */}
        <div className="shrink-0 w-1 sm:w-0" />
      </div>

      {/* Navigation arrows — desktop only */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll("left")}
          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-md cursor-pointer transition-all hover:shadow-lg active:scale-95 opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll("right")}
          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-md cursor-pointer transition-all hover:shadow-lg active:scale-95 opacity-0 group-hover/carousel:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Scroll fade hints */}
      {canScrollLeft && (
        <div className="hidden sm:block pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white/80 to-transparent" />
      )}
      {canScrollRight && (
        <div className="hidden sm:block pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white/80 to-transparent" />
      )}
    </div>
  );
}
