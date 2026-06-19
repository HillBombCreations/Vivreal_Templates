"use client";

import { useEffect, useRef } from "react";
import type { ContentLayoutProps } from "@/types/ContentItem";
// CC8 — shared rating glyph (single source of truth in the renderer package).
// This collapses the previously hand-synced ReviewsLayout copy into one import.
import {
  RatingGlyph,
  RATING_ICON_NOUN,
  resolveRatingIcon,
  resolveRatingMax,
  ratingTrackColor,
  type RatingIcon,
} from "@hillbombcreations/site-renderer";

const SCROLL_SPEED = 0.5;

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function Skeleton({ ratingCount = 5 }: { ratingCount?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 animate-pulse"
        >
          <div className="flex gap-1 mb-3">
            {/* P5 — placeholder glyph count driven by ratingMax, not hardcoded 5. */}
            {[...Array(ratingCount)].map((_, j) => (
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
/*  Rating display row                                                  */
/* ------------------------------------------------------------------ */

/**
 * Accessible rating row. Renders `max` glyphs filled to `value` (incl. one
 * per-icon-styled half via the shared `RatingGlyph`). Wrapped in `role="img"`
 * with a single accessible name so screen readers announce "X out of M ⟨icon⟩"
 * once, not per glyph.
 *
 * S5: when `value` is fractional, a small numeric badge (e.g. "4.5") sits beside
 * the glyph row so the half isn't ambiguous on the carousel.
 */
function RatingRow({
  icon,
  value,
  max,
  size,
  color,
}: {
  icon: RatingIcon;
  value: number;
  max: number;
  size: number;
  color: string;
}) {
  const trackColor = ratingTrackColor(color);
  const isFractional = Math.abs(value - Math.round(value)) > 1e-9;
  // The numeric glyph mode already shows the value — no extra badge there.
  const showBadge = isFractional && icon !== "number";
  return (
    <div className="flex items-center gap-1.5">
      <div
        role="img"
        aria-label={`${value} out of ${max} ${RATING_ICON_NOUN[icon]}`}
        // P3 — number stays tight; icon families breathe at gap-1.
        className={`flex items-center ${icon === "number" ? "gap-0.5" : "gap-1"}`}
      >
        {Array.from({ length: max }).map((_, i) => {
          const pos = i + 1;
          const fill: 0 | 0.5 | 1 =
            value >= pos ? 1 : value >= pos - 0.5 ? 0.5 : 0;
          return (
            <RatingGlyph
              key={i}
              icon={icon}
              fill={fill}
              size={size}
              color={color}
              trackColor={trackColor}
              value={pos}
            />
          );
        })}
      </div>
      {showBadge && (
        <span
          aria-hidden="true"
          className="text-xs font-semibold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field extraction (decimal rating + name/review fallbacks)          */
/* ------------------------------------------------------------------ */

/**
 * Extract a DECIMAL rating from a ContentItem, clamped to `[0, max]`.
 *
 * CC8: no `Math.round` (half-steps like 4.5 must survive) and no hardcoded 5
 * ceiling (driven by the configured `max`). Half values snap to the nearest
 * 0.5 so the display matches the input's discrete steps.
 */
function getRating(
  item: { raw?: Record<string, unknown> },
  max: number,
  ratingField?: string,
): number {
  const snap = (n: number) => Math.min(max, Math.max(0, Math.round(n * 2) / 2));

  if (!item.raw) return max;

  if (ratingField) {
    const explicit = item.raw[ratingField];
    if (typeof explicit === "number" && Number.isFinite(explicit)) return snap(explicit);
    if (typeof explicit === "string") {
      const n = parseFloat(explicit);
      if (!isNaN(n)) return snap(n);
    }
  }

  const r = item.raw.rating ?? item.raw.stars ?? item.raw.score;
  if (typeof r === "number") return snap(r);
  if (typeof r === "string") {
    const n = parseFloat(r);
    if (!isNaN(n)) return snap(n);
  }
  return max;
}

/** Reviewer name — `name` / `author` raw fallbacks, else the mapped title. */
function getName(item: { title: string; raw?: Record<string, unknown> }): string {
  const r = item.raw;
  if (r) {
    if (typeof r.name === "string" && r.name.trim()) return r.name;
    if (typeof r.author === "string" && r.author.trim()) return r.author;
  }
  return item.title;
}

/** Review text — `review` / `quote` raw fallbacks, else the mapped description. */
function getReviewText(item: {
  description?: string;
  raw?: Record<string, unknown>;
}): string | undefined {
  const r = item.raw;
  if (r) {
    if (typeof r.review === "string" && r.review.trim()) return r.review;
    if (typeof r.quote === "string" && r.quote.trim()) return r.quote;
  }
  return item.description;
}

/* ------------------------------------------------------------------ */
/*  Reviews Layout                                                     */
/* ------------------------------------------------------------------ */

export default function ReviewsLayout({
  items,
  accent,
  loading,
  emptyMessage,
  sectionConfig,
}: ContentLayoutProps) {
  const ratingField =
    typeof sectionConfig?.ratingField === "string"
      ? (sectionConfig.ratingField as string)
      : undefined;
  // CC8 — rating display style, linked to the review form's config. Falls back
  // to star / 5 so pre-CC8 Reviews sections render exactly as before.
  const ratingIcon = resolveRatingIcon(sectionConfig?.ratingIcon);
  const ratingMax = resolveRatingMax(sectionConfig?.ratingMax);
  // S5 — legible display glyphs: 16px base, shrinking to 14px at large `max` so
  // a max>=8 row still fits the card (parallels the input's max>=8 step-down).
  const glyphSize = ratingMax >= 8 ? 14 : 16;

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

  if (loading) return <Skeleton ratingCount={ratingMax} />;
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
          const rating = getRating(item, ratingMax, ratingField);
          const name = getName(item);
          const reviewText = getReviewText(item);

          return (
            <div
              key={`${item.id}-${idx}`}
              className="flex-shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm flex flex-col"
            >
              {/* Rating row (configurable icon + max + per-icon half fill) */}
              <div className="mb-3">
                <RatingRow
                  icon={ratingIcon}
                  value={rating}
                  max={ratingMax}
                  size={glyphSize}
                  color={primary}
                />
              </div>

              {/* Review text */}
              <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                {reviewText
                  ? <>&ldquo;{reviewText}&rdquo;</>
                  : <span className="text-black/30 italic">No review text</span>
                }
              </p>

              {/* Author info */}
              <div className="mt-auto pt-3 flex items-center gap-2">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={name}
                    className="h-8 w-8 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: primary }}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">{name}</p>
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
