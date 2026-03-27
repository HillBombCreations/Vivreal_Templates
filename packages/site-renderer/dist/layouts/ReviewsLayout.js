"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { Star } from "lucide-react";
const SCROLL_SPEED = 0.5;
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsx("div", { className: "flex gap-4 overflow-hidden", children: [...Array(4)].map((_, i) => (_jsxs("div", { className: "shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 animate-pulse", children: [_jsx("div", { className: "flex gap-1 mb-3", children: [...Array(5)].map((_, j) => (_jsx("div", { className: "h-3.5 w-3.5 rounded bg-black/[0.06]" }, j))) }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-4 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-4 w-3/4 rounded-lg bg-black/[0.04]" })] }), _jsxs("div", { className: "mt-4 flex items-center gap-2", children: [_jsx("div", { className: "h-8 w-8 rounded-full bg-black/[0.06]" }), _jsx("div", { className: "h-4 w-20 rounded-lg bg-black/[0.04]" })] })] }, i))) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ message }) {
    return (_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-12 text-center", children: _jsx("p", { className: "text-sm font-medium text-black/40", children: message || "No reviews yet." }) }));
}
/* ------------------------------------------------------------------ */
/*  Reviews Layout                                                     */
/* ------------------------------------------------------------------ */
/**
 * Extract a star rating from a ContentItem.
 * Looks at raw.rating, raw.stars, or falls back to 5.
 */
function getRating(item) {
    if (!item.raw)
        return 5;
    const r = item.raw.rating ?? item.raw.stars ?? item.raw.score;
    if (typeof r === "number")
        return Math.min(5, Math.max(0, Math.round(r)));
    if (typeof r === "string") {
        const n = parseInt(r, 10);
        if (!isNaN(n))
            return Math.min(5, Math.max(0, n));
    }
    return 5;
}
export default function ReviewsLayout({ items, accent, loading, emptyMessage, }) {
    const scrollRef = useRef(null);
    const pausedRef = useRef(false);
    const primary = accent || "var(--primary)";
    // Duplicate for seamless looping
    const displayItems = items.length >= 3 ? [...items, ...items] : items;
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || items.length === 0)
            return;
        let stopped = false;
        let pos = 0;
        const tick = () => {
            if (stopped)
                return;
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
            }
            else {
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
    if (loading)
        return _jsx(Skeleton, {});
    if (!items.length)
        return _jsx(Empty, { message: emptyMessage });
    return (_jsxs("div", { className: "relative", onMouseEnter: () => { pausedRef.current = true; }, onMouseLeave: () => { pausedRef.current = false; }, children: [_jsx("div", { className: "absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none", style: { background: "linear-gradient(to right, var(--surface, #fff), transparent)" } }), _jsx("div", { className: "absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none", style: { background: "linear-gradient(to left, var(--surface, #fff), transparent)" } }), _jsx("div", { ref: scrollRef, className: "flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden", style: { scrollbarWidth: "none", msOverflowStyle: "none" }, children: displayItems.map((item, idx) => {
                    const rating = getRating(item);
                    return (_jsxs("div", { className: "flex-shrink-0 w-72 sm:w-80 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm flex flex-col", children: [_jsx("div", { className: "flex items-center gap-0.5 mb-3", children: Array.from({ length: 5 }).map((_, i) => (_jsx(Star, { size: 14, className: i < rating ? "fill-current" : "text-gray-200", style: i < rating ? { color: primary } : undefined }, i))) }), _jsx("p", { className: "text-sm text-gray-700 leading-relaxed line-clamp-3", children: item.description
                                    ? _jsxs(_Fragment, { children: ["\u201C", item.description, "\u201D"] })
                                    : _jsx("span", { className: "text-black/30 italic", children: "No review text" }) }), _jsxs("div", { className: "mt-auto pt-3 flex items-center gap-2", children: [item.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    _jsx("img", { src: item.imageUrl, alt: item.title, className: "h-8 w-8 rounded-full object-cover", loading: "lazy" })) : (_jsx("div", { className: "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white", style: { backgroundColor: primary }, children: item.title.charAt(0).toUpperCase() })), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-gray-900", children: item.title }), item.date && (_jsx("p", { className: "text-[11px] text-gray-400", children: new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(item.date)) }))] })] })] }, `${item.id}-${idx}`));
                }) })] }));
}
