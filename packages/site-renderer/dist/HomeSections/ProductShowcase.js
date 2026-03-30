import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
const ProductShowcase = ({ config, siteData, prefetchedData }) => {
    const items = prefetchedData?.items || [];
    const sectionData = prefetchedData?.productShowcaseSection;
    const primary = siteData?.primary ?? "#1a1a2e";
    const surfaceAlt = siteData?.["surface-alt"] ?? "#f8f9fb";
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dir, setDir] = useState("right");
    const [animKey, setAnimKey] = useState(0);
    const current = useMemo(() => items[currentIndex], [items, currentIndex]);
    const goTo = (nextIndex, direction) => {
        if (!items.length)
            return;
        setDir(direction);
        setAnimKey((k) => k + 1);
        setCurrentIndex(nextIndex);
    };
    const nextCard = () => goTo((currentIndex + 1) % items.length, "right");
    const prevCard = () => goTo((currentIndex - 1 + items.length) % items.length, "left");
    if (!current)
        return null;
    return (_jsx("section", { style: { background: surfaceAlt }, className: "relative overflow-hidden py-20 md:py-28", children: _jsxs("div", { className: "max-w-7xl mx-auto px-5 sm:px-8 lg:px-12", children: [_jsxs("div", { className: "max-w-2xl mb-12 lg:mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight", children: sectionData?.title || config.heading || "Featured" }), _jsx("p", { className: "mt-4 text-base md:text-lg leading-relaxed text-black/55 max-w-lg", children: sectionData?.subtitle || config.subheading || "Explore our top picks" })] }), _jsxs("div", { className: "grid grid-cols-[1fr_auto] items-start gap-6", children: [_jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden", style: { animation: `${dir === "right" ? "slideInRight" : "slideInLeft"} 300ms ease-out` }, children: _jsxs("div", { className: "grid md:grid-cols-2 h-[400px] lg:h-[440px]", children: [_jsx("div", { className: "relative overflow-hidden", style: { background: `${primary}04` }, children: _jsx("img", { src: current.imageUrl || "", alt: current.title, className: "absolute inset-0 w-full h-full object-contain p-8 lg:p-12" }) }), _jsxs("div", { className: "p-8 lg:p-10 flex flex-col justify-center", children: [_jsx("span", { className: "inline-block w-fit rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider mb-4", style: { background: `${primary}0a`, color: primary }, children: "Featured" }), _jsx("h3", { className: "text-2xl lg:text-3xl font-bold tracking-tight", children: current.title }), _jsx("p", { className: "mt-3 text-sm md:text-[15px] leading-relaxed text-black/55", children: current.description }), _jsx("div", { className: "mt-8", children: _jsxs("a", { href: `/products?f_productType=${encodeURIComponent(current["product-type"] ?? "")}`, className: "group h-11 px-6 rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.98]", style: { background: primary, color: "white" }, children: [current.buttonLabel || "Shop now", _jsx(ArrowRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5" })] }) })] })] }) }, animKey), _jsxs("div", { className: "flex flex-col gap-2 pt-4", children: [_jsx("button", { type: "button", onClick: prevCard, className: "h-11 w-11 flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95", children: _jsx(ChevronLeft, { className: "h-5 w-5" }) }), _jsx("button", { type: "button", onClick: nextCard, className: "h-11 w-11 flex items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm hover:shadow-md transition active:scale-95", children: _jsx(ChevronRight, { className: "h-5 w-5" }) }), _jsxs("div", { className: "mt-2 text-center text-xs font-medium text-black/40", children: [currentIndex + 1, "/", items.length] })] })] })] }) }));
};
export default ProductShowcase;
