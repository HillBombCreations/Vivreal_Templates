"use client";

import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
import type { ReviewDisplay } from "@/types/Reviews";
import type { HomeSectionProps } from "../index";

const SCROLL_SPEED = 0.5;

export default function Testimonials({ config, siteData, prefetchedData }: HomeSectionProps) {
  const reviews = (prefetchedData?.reviews as ReviewDisplay[]) || [];
  const heading = (prefetchedData?.reviewsHeading as string)
    || (config.sectionName as string)
    || "What People Are Saying";

  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  const primary = siteData?.primary || "#000000";
  const surface = siteData?.surface || "#ffffff";

  // Duplicate reviews for seamless looping if we have enough
  const displayReviews = reviews.length >= 3 ? [...reviews, ...reviews] : reviews;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let stopped = false;
    let pos = 0;

    const tick = () => {
      if (stopped) return;
      if (!pausedRef.current) {
        pos += SCROLL_SPEED;
        el.scrollLeft = Math.round(pos);
        if (reviews.length >= 3) {
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

    // Delay start so layout is settled
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
  }, [reviews.length]);

  if (reviews.length === 0) return null;

  return (
    <section className="py-16 md:py-24 overflow-hidden" style={{ background: surface }}>
      <div className="mx-5 md:mx-20 lg:mx-40 mb-8">
        <h2 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">
          {heading}
        </h2>
      </div>

      <div
        className="relative mx-5 md:mx-20 lg:mx-40"
        onMouseEnter={() => { pausedRef.current = true; }}
        onMouseLeave={() => { pausedRef.current = false; }}
      >
        {/* Fade edges */}
        <div
          className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to right, ${surface}, transparent)` }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to left, ${surface}, transparent)` }}
        />

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {displayReviews.map((review, idx) => (
            <ReviewCard key={`${review.id}-${idx}`} review={review} primary={primary} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ review, primary }: { review: ReviewDisplay; primary: string }) {
  return (
    <div className="flex-shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm flex flex-col">
      <div className="flex items-center gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={14}
            className={i < review.rating ? "fill-current" : "text-gray-200"}
            style={i < review.rating ? { color: primary } : undefined}
          />
        ))}
      </div>

      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
        &ldquo;{review.review}&rdquo;
      </p>

      <div className="mt-auto pt-3 flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: primary }}
        >
          {review.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{review.name}</p>
          {review.date && (
            <p className="text-[11px] text-gray-400">
              {new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(review.date))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
