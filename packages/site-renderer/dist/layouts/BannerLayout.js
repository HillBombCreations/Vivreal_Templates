"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */
function Skeleton() {
    return (_jsx("div", { className: "min-h-[60vh] overflow-hidden animate-pulse bg-black/[0.04]", children: _jsx("div", { className: "content-grid", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[60vh] py-16", children: [_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "h-10 w-3/4 rounded-lg bg-black/[0.06]" }), _jsx("div", { className: "h-6 w-full rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "h-6 w-2/3 rounded-lg bg-black/[0.04]" }), _jsx("div", { className: "mt-4 h-12 w-40 rounded-full bg-black/[0.06]" })] }), _jsx("div", { className: "h-80 rounded-2xl bg-black/[0.06]" })] }) }) }));
}
/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */
function Empty({ accent }) {
    return (_jsx("div", { className: "min-h-[40vh] overflow-hidden flex items-center justify-center", style: { background: `color-mix(in srgb, ${accent} 8%, white)` }, children: _jsx("div", { className: "text-center px-8", children: _jsx("h2", { className: "text-3xl md:text-4xl font-bold tracking-tight", style: { color: accent }, children: "Welcome" }) }) }));
}
/* ------------------------------------------------------------------ */
/*  Banner Layout — split: text left, image right                      */
/* ------------------------------------------------------------------ */
export default function BannerLayout({ items, accent, loading, pageLabels, }) {
    if (loading)
        return _jsx(Skeleton, {});
    const primary = accent || "var(--primary)";
    const labels = pageLabels ?? {};
    const heroTitle = labels.title || items[0]?.title || "Welcome";
    const heroSubtitle = labels.subtitle || items[0]?.description;
    const heroImageField = labels.heroImage;
    const heroImage = heroImageField?.currentFile?.source || items[0]?.imageUrl;
    const buttonLabel = labels.buttonLabel || items[0]?.tags?.[0];
    const buttonLink = labels.buttonLink || items[0]?.href;
    const trustIndicators = labels?.trustIndicators ?? [
        { icon: '✓', text: 'Quality Guaranteed' },
        { icon: '♥', text: 'Made with Care' },
        { icon: '📍', text: 'Local Pickup' },
    ];
    if (!heroTitle && !items.length)
        return _jsx(Empty, { accent: primary });
    return (_jsxs("section", { className: "relative overflow-hidden", style: {
            background: `linear-gradient(135deg, color-mix(in srgb, ${primary} 6%, white), color-mix(in srgb, ${primary} 12%, white))`,
        }, children: [_jsx("div", { className: "absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20", style: { background: primary } }), _jsx("div", { className: "absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-10", style: { background: primary } }), _jsx("div", { className: "content-grid relative", children: _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center min-h-[60vh] md:min-h-[70vh] pt-24 md:pt-28 pb-16 md:pb-20", children: [_jsxs("div", { className: "flex flex-col justify-center order-2 lg:order-1", children: [_jsx("h1", { className: "text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]", style: { color: "var(--text-primary, #111)" }, children: heroTitle }), heroSubtitle && (_jsx("p", { className: "mt-5 text-base sm:text-lg leading-relaxed max-w-lg", style: { color: "var(--text-secondary, #555)" }, children: heroSubtitle })), buttonLabel && buttonLink && (_jsx("div", { className: "mt-8", children: _jsxs("a", { href: buttonLink, className: "group inline-flex items-center gap-2 h-12 px-7 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] text-white", style: { background: primary }, children: [buttonLabel, _jsx("svg", { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M13 7l5 5m0 0l-5 5m5-5H6" }) })] }) })), _jsx("div", { className: "mt-8 flex items-center gap-5 text-xs", style: { color: "var(--text-secondary, #555)" }, children: trustIndicators.map((ti) => (_jsxs("span", { className: "flex items-center gap-1.5 opacity-60", children: [_jsx("span", { children: ti.icon }), ti.text] }, ti.text))) })] }), _jsx("div", { className: "order-1 lg:order-2 flex justify-center lg:justify-end", children: heroImage ? (_jsxs("div", { className: "relative w-full max-w-md lg:max-w-lg", children: [_jsx("div", { className: "absolute inset-0 rounded-3xl blur-2xl opacity-20 scale-95", style: { background: primary } }), _jsx("img", { src: heroImage, alt: heroTitle, className: "relative w-full h-auto rounded-3xl shadow-2xl object-cover", loading: "eager" })] })) : (_jsx("div", { className: "w-full max-w-md lg:max-w-lg aspect-[4/3] rounded-3xl", style: { background: `color-mix(in srgb, ${primary} 15%, white)` } })) })] }) })] }));
}
