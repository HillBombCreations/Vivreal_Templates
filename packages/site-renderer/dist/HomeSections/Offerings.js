import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { IconMap } from "../types/Landing";
function DesktopDetailCard({ selected, textPrimary }) {
    return (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden", children: [_jsxs("div", { className: "p-6 pb-4", children: [_jsx("h3", { className: "text-xl font-bold tracking-tight", style: { color: textPrimary }, children: selected.title }), _jsx("p", { className: "mt-2 text-sm leading-relaxed text-black/50 max-w-2xl line-clamp-2 min-h-[2.5em]", children: selected.description })] }), _jsx("div", { className: "px-6 pb-6", children: _jsx("div", { className: "rounded-xl overflow-hidden bg-black/[0.02] border border-black/[0.04]", children: _jsx("div", { className: "flex items-center justify-center p-8 min-h-[360px]", children: selected.imageUrl && _jsx("img", { src: selected.imageUrl, alt: selected.title, draggable: false, className: "max-h-[320px] w-full object-contain" }) }) }) })] }));
}
function MobileDetailCard({ selected, primary, textInverse }) {
    return (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden", children: [_jsxs("div", { className: "px-5 py-4", style: { background: primary, color: textInverse }, children: [_jsx("div", { className: "text-sm font-semibold truncate", children: selected.title }), _jsx("div", { className: "mt-1 text-xs opacity-80 line-clamp-2", children: selected.description })] }), _jsx("div", { className: "p-4", children: _jsx("div", { className: "rounded-xl overflow-hidden bg-black/[0.02] border border-black/[0.04]", children: _jsx("div", { className: "flex items-center justify-center p-4 min-h-[220px]", children: selected.imageUrl && _jsx("img", { src: selected.imageUrl, alt: selected.title, draggable: false, className: "max-h-[200px] w-full object-contain" }) }) }) })] }));
}
const Offerings = ({ siteData, prefetchedData }) => {
    const items = prefetchedData?.items || [];
    const primary = siteData?.primary ?? "#1a1a2e";
    const surfaceAlt = siteData?.["surface-alt"] ?? "#f8f9fb";
    const textPrimary = siteData?.["text-primary"] ?? "#0b1220";
    const textInverse = siteData?.["text-inverse"] ?? "#ffffff";
    const first = useMemo(() => items[0], [items]);
    const [selected, setSelected] = useState(first);
    // Sync selected when items arrive (initial render may have empty items)
    useEffect(() => {
        if (items.length > 0 && !selected)
            setSelected(items[0]);
    }, [items, selected]);
    if (!selected || items.length === 0)
        return null;
    return (_jsx("section", { style: { background: surfaceAlt }, className: "relative overflow-hidden py-20 md:py-28", children: _jsxs("div", { className: "max-w-7xl mx-auto px-5 sm:px-8 lg:px-12", children: [_jsxs("div", { className: "max-w-2xl mb-12 lg:mb-16", children: [_jsx("h2", { className: "text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight", children: "What we offer" }), _jsx("p", { className: "mt-4 text-base md:text-lg leading-relaxed text-black/55", children: "Everything you need, all in one place." })] }), _jsxs("div", { className: "lg:hidden", children: [_jsx("div", { className: "flex flex-wrap gap-2 mb-6", children: items.map((card, idx) => {
                                const isSelected = card._id ? card._id === selected._id : idx === items.indexOf(selected);
                                const icon = card.icon || "lightBulb";
                                return (_jsxs("button", { type: "button", onClick: () => setSelected(card), className: "inline-flex items-center gap-2 h-10 px-3.5 rounded-full border text-[13px] font-medium transition active:scale-[0.98]", style: {
                                        borderColor: isSelected ? `${primary}30` : "rgba(0,0,0,0.06)",
                                        background: isSelected ? "white" : "rgba(255,255,255,0.6)",
                                        color: isSelected ? primary : "rgba(0,0,0,0.65)",
                                        boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                                    }, children: [_jsx("span", { className: "grid place-items-center h-6 w-6 rounded-full shrink-0", style: { background: isSelected ? primary : "rgba(0,0,0,0.05)", color: isSelected ? textInverse : "rgba(0,0,0,0.55)" }, children: _jsx("span", { className: "[&>svg]:h-3.5 [&>svg]:w-3.5", children: IconMap[icon] || IconMap.lightBulb }) }), _jsx("span", { className: "truncate", children: card.title })] }, card._id || idx));
                            }) }), _jsx(MobileDetailCard, { selected: selected, primary: primary, textInverse: textInverse })] }), _jsxs("div", { className: "hidden lg:grid grid-cols-12 gap-8 items-start", children: [_jsx("div", { className: "col-span-5 flex flex-col gap-3", children: items.map((card, idx) => {
                                const isSelected = card._id ? card._id === selected._id : idx === items.indexOf(selected);
                                const icon = card.icon || "lightBulb";
                                return (_jsxs("button", { type: "button", onClick: () => setSelected(card), className: "w-full cursor-pointer rounded-2xl border text-left transition-all flex items-center gap-4 px-5 py-5", style: {
                                        borderColor: isSelected ? `${primary}20` : "rgba(0,0,0,0.04)",
                                        background: isSelected ? "white" : "rgba(255,255,255,0.5)",
                                        boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
                                    }, children: [_jsx("div", { className: "shrink-0 grid place-items-center rounded-xl h-11 w-11", style: { background: isSelected ? primary : "rgba(0,0,0,0.04)", color: isSelected ? textInverse : "rgba(0,0,0,0.55)" }, children: _jsx("span", { className: "[&>svg]:h-5 [&>svg]:w-5", children: IconMap[icon] || IconMap.lightBulb }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-semibold tracking-tight", style: { color: textPrimary }, children: card.title }), _jsx("div", { className: "mt-1 text-sm leading-relaxed text-black/50 line-clamp-2 min-h-[2.5em]", children: card.description })] })] }, card._id || idx));
                            }) }), _jsx("div", { className: "col-span-7", children: _jsx(DesktopDetailCard, { selected: selected, textPrimary: textPrimary }) })] })] }) }));
};
export default Offerings;
