"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: [...Array(6)].map((_, i) => (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-6 animate-pulse", children: [_jsx("div", { className: "h-12 w-12 rounded-xl bg-black/[0.04] mb-4" }), _jsx("div", { className: "h-5 w-2/3 rounded-lg bg-black/[0.06]" }), _jsxs("div", { className: "mt-3 space-y-2", children: [_jsx("div", { className: "h-4 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-4 w-3/4 rounded-lg bg-black/[0.04]" })] })] }, i))) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ message }) {
    return (_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-12 text-center", children: _jsx("p", { className: "text-sm font-medium text-black/40", children: message || "No features to display yet." }) }));
}
/* ------------------------------------------------------------------ */
/*  Feature List Layout                                                */
/* ------------------------------------------------------------------ */
export default function FeatureListLayout({ items, accent, loading, emptyMessage, }) {
    if (loading)
        return _jsx(Skeleton, {});
    if (!items.length)
        return _jsx(Empty, { message: emptyMessage });
    const primary = accent || "var(--primary)";
    return (_jsx("div", { className: "rounded-3xl py-14 md:py-20 px-6 md:px-10", style: { background: `color-mix(in srgb, ${primary} 5%, white)` }, children: _jsx("div", { className: "grid gap-6 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item) => (_jsxs("div", { className: "rounded-2xl bg-white p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5", children: [_jsx("div", { className: "h-48 md:h-56 w-full rounded-2xl flex items-center justify-center mb-5 overflow-hidden", style: { background: `color-mix(in srgb, ${primary} 6%, transparent)` }, children: item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        _jsx("img", { src: item.imageUrl, alt: item.title, className: "h-full w-full object-contain p-2", loading: "lazy" })) : (_jsx("span", { className: "text-xl font-bold", style: { color: primary }, children: item.title.charAt(0).toUpperCase() })) }), _jsx("h3", { className: "text-lg font-semibold tracking-tight", children: item.title }), item.description && (_jsx("p", { className: "mt-2.5 text-sm leading-relaxed text-black/55", children: item.description })), item.tags && item.tags.length > 0 && (_jsx("div", { className: "mt-5 flex gap-1.5 flex-wrap", children: item.tags.slice(0, 3).map((tag) => (_jsx("span", { className: "rounded-full px-2.5 py-0.5 text-[11px] font-medium", style: {
                                background: `color-mix(in srgb, ${primary} 10%, transparent)`,
                                color: primary,
                            }, children: tag }, tag))) }))] }, item.id))) }) }));
}
