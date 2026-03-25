"use client";

import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import type { ContentLayoutProps } from "@/types/ContentItem";

const SCROLL_SPEED = 0.5;

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 animate-pulse"
        >
          <div className="flex gap-1 mb-3">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-3.5 w-3.5 rounded bg-black/[0.06]" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-4 w-full rounded-lg bg-black/[0.04]" />
            <div className="h-4 w-3/4 rounded-lg bg-black/[0.04]" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-black/[0.06]" />
            <div className="h-4 w-20 rounded-lg bg-black/[0.04]" />
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
        {message || "No reviews yet."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Reviews Layout                                                     */
/* ------------------------------------------------------------------ */

/**
 * Extract a star rating from a ContentItem.
 * Looks at raw.rating, raw.stars, or falls back to 5.
 */
function getRating(item: { raw?: Record<string, unknown> }): number {
  if (!item.raw) return 5;
  const r = item.raw.rating ?? item.raw.stars ?? item.raw.score;
  if (typeof r === "number") return Math.min(5, Math.max(0, Math.round(r)));
  if (typeof r === "string") {
    const n = parseInt(r, 10);
    if (!isNaN(n)) return Math.min(5, Math.max(0, n));
  }
  return 5;
}

export default function ReviewsLayout({
  items,
  accent,
  loading,
  emptyMessage,
}: ContentLayoutProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const primary = accent || "var(--primary)";

  // Duplicate for seamless looping
  const displayItems = items.length >= 3 ? [...items, ...items] : items;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;

    let stopped = false;
    let pos = 0;

    const tick = () => {
      if (stopped) return;
      if (!pausedRef.current && el.scrollWidth > el.clientWidth) {
        pos += SCROLL_SPEED;
        el.scrollLeft = Math.round(pos);
        if (items.length >= 3) {
          const halfWidth = el.scrollWidth / 2;
          if (el.scrollLeft >= halfWidth) {
            pos -= halfWidth;
            el.scrollLeft = Math.round(pos);
          }
        }
      } else {
        pos = el.scrollLeft;
      }
      requestAnimationFrame(tick);
    };

    const timer = setTimeout(() => {
      if (!stopped && el.scrollWidth > el.clientWidth) {
        pos = el.scrollLeft;
        requestAnimationFrame(tick);
      }
    }, 100);

    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [items.length]);

  if (loading) return <Skeleton />;
  if (!items.length) return <Empty message={emptyMessage} />;

  return (
    <div
      className="relative"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to right, var(--surface, #fff), transparent)" }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{ background: "linear-gradient(to left, var(--surface, #fff), transparent)" }}
      />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {displayItems.map((item, idx) => {
          const rating = getRating(item);

          return (
            <div
              key={`${item.id}-${idx}`}
              className="flex-shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm flex flex-col"
            >
              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={i < rating ? "fill-current" : "text-gray-200"}
                    style={i < rating ? { color: primary } : undefined}
                  />
                ))}
              </div>

              {/* Review text (description) */}
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                {item.description
                  ? <>&ldquo;{item.description}&rdquo;</>
                  : <span className="text-black/30 italic">No review text</span>
                }
              </p>

              {/* Author info */}
              <div className="mt-auto pt-3 flex items-center gap-2">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {item.title.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  {item.date && (
                    <p className="text-[11px] text-gray-400">
                      {new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(item.date))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
