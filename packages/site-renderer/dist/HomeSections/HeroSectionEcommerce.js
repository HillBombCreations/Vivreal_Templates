import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowRight, Truck, Shield, Star } from "lucide-react";
const HeroSectionEcommerce = ({ config, siteData, prefetchedData }) => {
    const heroSection = prefetchedData?.heroSection;
    const primary = siteData?.primary ?? "#1a1a2e";
    const surface = siteData?.surface ?? "#ffffff";
    const textPrimary = siteData?.["text-primary"] ?? "#0b1220";
    const textMuted = siteData?.["text-secondary"] ?? "#64748b";
    const title = heroSection?.title ?? "Your Store";
    const subtitle = heroSection?.subtitle ??
        "Discover best-sellers, new arrivals, and everyday essentials — delivered fast.";
    const imageSrc = heroSection?.imageUrl || "";
    const ctaLabel = heroSection?.buttonLabel ?? "Shop new arrivals";
    const ctaHref = config.linkTo ?? "/products";
    const hasShipping = siteData?.businessInfo?.shipping !== false;
    const trustItems = [
        { icon: _jsx(Truck, { className: "h-4 w-4" }), label: hasShipping ? "Fast delivery" : "Pickup available" },
        { icon: _jsx(Shield, { className: "h-4 w-4" }), label: "Secure checkout" },
        { icon: _jsx(Star, { className: "h-4 w-4" }), label: "Top quality" },
    ];
    return (_jsxs("section", { style: { background: surface }, className: "relative min-h-[100svh] overflow-hidden", children: [_jsx("div", { className: "pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[120px] opacity-[0.07]", style: { background: primary } }), _jsx("div", { className: "pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full blur-[100px] opacity-[0.05]", style: { background: primary } }), _jsx("div", { className: "relative max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 min-h-[100svh] flex items-center", children: _jsxs("div", { className: "w-full grid items-center gap-12 lg:gap-20 lg:grid-cols-2 py-24 lg:py-0", children: [_jsxs("div", { className: "order-1 text-center lg:text-left animate-fade-in", children: [_jsxs("div", { className: "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide uppercase mb-6", style: { borderColor: `${primary}20`, color: textMuted }, children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full", style: { background: primary } }), "Welcome to ", siteData?.name || "our store"] }), _jsx("h1", { className: "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08]", style: { color: textPrimary }, children: title }), _jsx("p", { className: "mt-6 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0", style: { color: textMuted }, children: subtitle }), _jsx("div", { className: "mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start", children: _jsxs("a", { href: ctaHref, className: "group h-12 px-7 inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]", style: { background: primary, color: "white" }, children: [ctaLabel, _jsx(ArrowRight, { className: "h-4 w-4 transition-transform group-hover:translate-x-0.5" })] }) }), _jsx("div", { className: "mt-10 flex items-center gap-6 justify-center lg:justify-start", children: trustItems.map((item) => (_jsxs("div", { className: "flex items-center gap-2 text-xs font-medium", style: { color: textMuted }, children: [_jsx("span", { style: { color: primary }, children: item.icon }), item.label] }, item.label))) })] }), _jsx("div", { className: "order-2 animate-fade-in", children: _jsx("div", { className: "relative rounded-3xl overflow-hidden aspect-square lg:aspect-[4/5]", style: { background: `${primary}06` }, children: imageSrc ? (_jsx("img", { src: imageSrc, alt: `${title} hero image`, className: "relative w-full h-full object-contain p-8 lg:p-12", draggable: false })) : (_jsx("div", { className: "w-full h-full", style: { background: `${primary}08` } })) }) })] }) })] }));
};
export default HeroSectionEcommerce;
