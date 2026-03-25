"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white overflow-hidden animate-pulse", children: _jsxs("div", { className: "grid md:grid-cols-2 h-[400px]", children: [_jsx("div", { className: "bg-black/[0.04]" }), _jsxs("div", { className: "p-8 flex flex-col justify-center gap-4", children: [_jsx("div", { className: "h-6 w-1/3 rounded-lg bg-black/[0.06]" }), _jsx("div", { className: "h-8 w-3/4 rounded-lg bg-black/[0.06]" }), _jsx("div", { className: "h-4 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-4 w-2/3 rounded-lg bg-black/[0.04]" })] })] }) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ message }) {
    return (_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-12 text-center", children: _jsx("p", { className: "text-sm font-medium text-black/40", children: message || "Nothing to showcase yet." }) }));
}
/* ------------------------------------------------------------------ */
/*  Showcase Layout                                                    */
/* ------------------------------------------------------------------ */
export default function ShowcaseLayout({ items, slug, detailEnabled, accent, loading, emptyMessage, }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(null);
    const [animKey, setAnimKey] = useState(0);
    const [touchStartX, setTouchStartX] = useState(null);
    if (loading)
        return _jsx(Skeleton, {});
    if (!items.length)
        return _jsx(Empty, { message: emptyMessage });
    const primary = accent || "var(--primary)";
    const current = items[currentIndex];
    const next = () => {
        setDirection("right");
        setCurrentIndex((i) => (i + 1) % items.length);
        setAnimKey((k) => k + 1);
    };
    const prev = () => {
        setDirection("left");
        setCurrentIndex((i) => (i - 1 + items.length) % items.length);
        setAnimKey((k) => k + 1);
    };
    const onTouchStart = (e) => {
        setTouchStartX(e.touches[0]?.clientX ?? null);
    };
    const onTouchEnd = (e) => {
        if (touchStartX == null)
            return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX;
        const dx = endX - touchStartX;
        setTouchStartX(null);
        if (Math.abs(dx) < 40)
            return;
        if (dx < 0)
            next();
        else
            prev();
    };
    const detailHref = detailEnabled ? `/${slug}/${encodeURIComponent(current.id)}` : undefined;
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "hidden md:grid grid-cols-[1fr_auto] items-start gap-4", children: [_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden", children: _jsxs("div", { className: `grid md:grid-cols-2 h-[400px] lg:h-[440px] ${direction === "right" ? "animate-slide-in-right" : direction === "left" ? "animate-slide-in-left" : ""}`, children: [_jsx("div", { className: "relative overflow-hidden", style: { background: `color-mix(in srgb, ${primary} 3%, white)` }, children: current.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    _jsx("img", { src: current.imageUrl, alt: current.title, className: "absolute inset-0 w-full h-full object-contain p-8 lg:p-12" })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("div", { className: "h-20 w-20 rounded-2xl bg-black/[0.04]" }) })) }), _jsxs("div", { className: "p-8 lg:p-10 flex flex-col justify-center", children: [_jsx("span", { className: "inline-block w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4", style: { background: `color-mix(in srgb, ${primary} 8%, transparent)`, color: primary }, children: "Featured" }), _jsx("h3", { className: "text-2xl lg:text-3xl font-bold tracking-tight", children: current.title }), current.description && (_jsx("p", { className: "mt-3 text-sm md:text-[15px] leading-relaxed text-black/55 line-clamp-3", children: current.description })), current.price && (_jsx("p", { className: "mt-4 text-xl font-bold", style: { color: primary }, children: current.price })), (() => {
                                            const raw = current.raw ?? {};
                                            const btnLabel = raw.buttonLabel || (detailHref ? "View details" : null);
                                            const productType = raw["product-type"] || raw.productType;
                                            const href = productType
                                                ? `/products?f_productType=${encodeURIComponent(productType)}`
                                                : detailHref;
                                            if (!btnLabel || !href)
                                                return null;
                                            return (_jsx("div", { className: "mt-6", children: _jsxs("a", { href: href, className: "group h-11 px-6 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.98]", style: { background: primary, color: "white" }, children: [btnLabel, _jsx(ArrowRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5" })] }) }));
                                        })()] })] }, animKey) }), items.length > 1 && (_jsxs("div", { className: "flex flex-col gap-2 pt-4", children: [_jsx("button", { type: "button", onClick: prev, className: "h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95", "aria-label": "Previous item", children: _jsx(ChevronLeft, { className: "h-5 w-5" }) }), _jsx("button", { type: "button", onClick: next, className: "h-11 w-11 cursor-pointer flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95", "aria-label": "Next item", children: _jsx(ChevronRight, { className: "h-5 w-5" }) }), _jsxs("div", { className: "mt-2 text-center text-xs font-medium text-black/40", children: [currentIndex + 1, "/", items.length] })] }))] }), _jsxs("div", { className: "md:hidden", onTouchStart: onTouchStart, onTouchEnd: onTouchEnd, children: [_jsxs("div", { className: `rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden ${direction === "right" ? "animate-slide-in-right" : direction === "left" ? "animate-slide-in-left" : ""}`, children: [current.imageUrl && (_jsx("div", { className: "relative h-[260px] sm:h-[300px] overflow-hidden", style: { background: `color-mix(in srgb, ${primary} 3%, white)` }, children: _jsx("img", { src: current.imageUrl, alt: current.title, draggable: false, className: "h-full w-full object-contain p-6" }) })), _jsxs("div", { className: "p-5 sm:p-6", children: [_jsx("h3", { className: "text-xl font-bold tracking-tight", children: current.title }), current.description && (_jsx("p", { className: "mt-2 text-sm leading-relaxed text-black/55 line-clamp-3", children: current.description })), current.price && (_jsx("p", { className: "mt-3 text-lg font-bold", style: { color: primary }, children: current.price })), (() => {
                                        const raw = current.raw ?? {};
                                        const btnLabel = raw.buttonLabel || "View details";
                                        const productType = raw["product-type"] || raw.productType;
                                        const href = productType
                                            ? `/products?f_productType=${encodeURIComponent(productType)}`
                                            : detailHref;
                                        if (!href)
                                            return null;
                                        return (_jsxs("a", { href: href, className: "mt-4 group h-10 px-5 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.98]", style: { background: primary, color: "white" }, children: [btnLabel, _jsx(ArrowRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5" })] }));
                                    })()] })] }, animKey), items.length > 1 && (_jsx("div", { className: "mt-4 flex items-center justify-center gap-2", children: items.map((_, i) => (_jsx("button", { type: "button", "aria-label": `Go to item ${i + 1}`, onClick: () => setCurrentIndex(i), className: "h-2 rounded-full transition-all duration-300", style: {
                                width: i === currentIndex ? 24 : 8,
                                background: i === currentIndex ? primary : "rgba(0,0,0,0.12)",
                            } }, i))) }))] })] }));
}
