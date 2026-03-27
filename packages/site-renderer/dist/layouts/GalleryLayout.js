"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import ItemLink from "../components/ItemLink";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    const heights = [240, 320, 200, 280, 220, 300, 260, 180];
    return (_jsx("div", { className: "columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4", children: heights.map((h, i) => (_jsx("div", { className: "break-inside-avoid rounded-2xl overflow-hidden animate-pulse bg-black/[0.04]", style: { height: h } }, i))) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ message }) {
    return (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-12 text-center", children: [_jsx("div", { className: "mx-auto mb-3 h-12 w-12 rounded-full bg-black/[0.03] flex items-center justify-center", children: _jsx("svg", { className: "h-6 w-6 text-black/20", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" }) }) }), _jsx("p", { className: "text-sm font-medium text-black/40", children: message || "Nothing to display yet." })] }));
}
/* ------------------------------------------------------------------ */
/*  Gallery Layout — CSS-columns masonry                               */
/* ------------------------------------------------------------------ */
export default function GalleryLayout({ items, slug, detailEnabled, accent, loading, emptyMessage, LinkComponent, }) {
    if (loading)
        return _jsx(Skeleton, {});
    if (!items.length)
        return _jsx(Empty, { message: emptyMessage });
    const primary = accent || "var(--primary)";
    return (_jsx("div", { className: "columns-2 sm:columns-3 lg:columns-4 gap-3 sm:gap-4 space-y-3 sm:space-y-4", children: items.map((item) => (_jsx(ItemLink, { href: `/${slug}/${encodeURIComponent(item.id)}`, enabled: detailEnabled, LinkComponent: LinkComponent, className: `group break-inside-avoid block rounded-2xl overflow-hidden relative ${detailEnabled ? "cursor-pointer" : ""}`, children: item.imageUrl ? (_jsxs(_Fragment, { children: [_jsx("img", { src: item.imageUrl, alt: item.title, className: "w-full h-auto block transition-transform duration-700 group-hover:scale-105", loading: "lazy" }), _jsx("div", { className: "absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex flex-col justify-end p-4 sm:p-5", children: _jsxs("div", { className: "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300", children: [_jsx("h3", { className: "font-semibold text-sm sm:text-base text-white leading-snug line-clamp-2 drop-shadow-sm", children: item.title }), item.description && (_jsx("p", { className: "mt-1.5 text-xs sm:text-sm text-white/75 line-clamp-2 leading-relaxed", children: item.description })), item.price && (_jsx("span", { className: "mt-2 inline-block text-sm font-bold text-white drop-shadow-sm", children: item.price }))] }) }), item.tags && item.tags.length > 0 && (_jsx("div", { className: "absolute top-3 left-3 flex gap-1", children: _jsx("span", { className: "rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur-sm", style: {
                                background: `color-mix(in srgb, ${primary} 85%, white)`,
                                color: "white",
                            }, children: item.tags[0] }) }))] })) : (
            /* Fallback when no image — show as a styled card */
            _jsxs("div", { className: "p-6 sm:p-7 min-h-[180px] flex flex-col justify-end", style: {
                    background: `color-mix(in srgb, ${primary} 4%, white)`,
                }, children: [_jsx("h3", { className: "font-semibold text-sm sm:text-base leading-snug line-clamp-2", children: item.title }), item.description && (_jsx("p", { className: "mt-2 text-xs sm:text-sm text-black/45 line-clamp-3 leading-relaxed", children: item.description })), item.tags && item.tags.length > 0 && (_jsx("div", { className: "mt-3 flex gap-1.5 flex-wrap", children: item.tags.slice(0, 2).map((tag) => (_jsx("span", { className: "rounded-full px-2 py-0.5 text-[10px] font-medium", style: {
                                background: `color-mix(in srgb, ${primary} 8%, transparent)`,
                                color: primary,
                            }, children: tag }, tag))) }))] })) }, item.id))) }));
}
