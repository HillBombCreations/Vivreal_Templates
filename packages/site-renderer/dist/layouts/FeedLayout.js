"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import ItemLink from "../components/ItemLink";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsx("div", { className: "mx-auto max-w-2xl space-y-6", children: [...Array(3)].map((_, i) => (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white overflow-hidden animate-pulse", children: [_jsx("div", { className: "h-[280px] sm:h-[340px] bg-black/[0.04]" }), _jsxs("div", { className: "p-6 sm:p-8", children: [_jsx("div", { className: "flex items-center gap-3 mb-4", children: _jsx("div", { className: "h-4 w-24 rounded-full bg-black/[0.06]" }) }), _jsx("div", { className: "h-6 w-3/4 rounded-lg bg-black/[0.06]" }), _jsxs("div", { className: "mt-4 space-y-2", children: [_jsx("div", { className: "h-4 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-4 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-4 w-2/3 rounded-lg bg-black/[0.04]" })] }), _jsxs("div", { className: "mt-5 flex gap-2", children: [_jsx("div", { className: "h-6 w-16 rounded-full bg-black/[0.04]" }), _jsx("div", { className: "h-6 w-16 rounded-full bg-black/[0.04]" })] })] })] }, i))) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ message }) {
    return (_jsxs("div", { className: "mx-auto max-w-2xl rounded-2xl border border-black/[0.06] bg-white p-12 text-center", children: [_jsx("div", { className: "mx-auto mb-3 h-12 w-12 rounded-full bg-black/[0.03] flex items-center justify-center", children: _jsx("svg", { className: "h-6 w-6 text-black/20", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 1.5, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z" }) }) }), _jsx("p", { className: "text-sm font-medium text-black/40", children: message || "Nothing to display yet." })] }));
}
/* ------------------------------------------------------------------ */
/*  Feed Layout — vertical social-style feed                           */
/* ------------------------------------------------------------------ */
export default function FeedLayout({ items, slug, detailEnabled, accent, loading, emptyMessage, LinkComponent, }) {
    if (loading)
        return _jsx(Skeleton, {});
    if (!items.length)
        return _jsx(Empty, { message: emptyMessage });
    const primary = accent || "var(--primary)";
    return (_jsx("div", { className: "mx-auto max-w-2xl space-y-6", children: items.map((item) => (_jsxs(ItemLink, { href: `/${slug}/${encodeURIComponent(item.id)}`, enabled: detailEnabled, LinkComponent: LinkComponent, className: `group block rounded-2xl border border-black/[0.06] bg-white overflow-hidden transition-all duration-300 hover:shadow-lg ${detailEnabled ? "cursor-pointer" : ""}`, children: [item.imageUrl && (_jsx("div", { className: "relative overflow-hidden", children: _jsx("img", { src: item.imageUrl, alt: item.title, className: "w-full h-auto max-h-[400px] object-cover transition-transform duration-700 group-hover:scale-[1.02]", loading: "lazy" }) })), _jsxs("div", { className: "p-6 sm:p-8", children: [_jsxs("div", { className: "flex items-center gap-3 text-xs text-black/40 mb-3", children: [item.date && (_jsx("time", { className: "font-medium", children: item.date })), item.source === "integration" && item.integrationType && (_jsxs(_Fragment, { children: [_jsx("span", { className: "h-1 w-1 rounded-full bg-black/20" }), _jsx("span", { className: "capitalize", children: item.integrationType })] }))] }), _jsx("h3", { className: "text-xl sm:text-2xl font-bold tracking-tight leading-snug", children: item.title }), item.description && (_jsx("p", { className: "mt-3 text-[15px] text-black/55 leading-relaxed whitespace-pre-line", children: item.description })), item.price && (_jsx("div", { className: "mt-4 text-xl font-bold", style: { color: primary }, children: item.price })), item.tags && item.tags.length > 0 && (_jsx("div", { className: "mt-5 flex gap-2 flex-wrap", children: item.tags.map((tag) => (_jsx("span", { className: "rounded-full px-3 py-1 text-xs font-medium transition-colors duration-200", style: {
                                    background: `color-mix(in srgb, ${primary} 7%, transparent)`,
                                    color: primary,
                                }, children: tag }, tag))) })), detailEnabled && (_jsxs("div", { className: "mt-5 inline-flex items-center gap-1.5 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300", style: { color: primary }, children: ["Read more", _jsx("svg", { className: "h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" }) })] }))] })] }, item.id))) }));
}
