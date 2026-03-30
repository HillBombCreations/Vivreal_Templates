import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, ShoppingCart } from "lucide-react";
import ContentRenderer from "../ContentRenderer";
const SORT_OPTIONS = [
    { key: "featured", label: "Featured" },
    { key: "createdAt:desc", label: "Newest" },
    { key: "price:asc", label: "Price: Low → High" },
    { key: "price:desc", label: "Price: High → Low" },
    { key: "name:asc", label: "Name: A → Z" },
];
function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}
/* ------------------------------------------------------------------ */
/* Sort Dropdown                                                       */
/* ------------------------------------------------------------------ */
function SortDropdown({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);
    const selected = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];
    useEffect(() => {
        const onDown = (e) => {
            if (!wrapRef.current?.contains(e.target))
                setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, []);
    return (_jsxs("div", { ref: wrapRef, className: "relative", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "inline-flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 backdrop-blur px-3 h-9 text-sm font-semibold shadow-sm transition hover:bg-white", style: { borderColor: "rgba(0,0,0,0.08)" }, children: [_jsx(ArrowUpDown, { className: "h-4 w-4 text-black/60" }), _jsx("span", { className: "text-black/70", children: "Sort:" }), _jsx("span", { className: "text-black", children: selected.label })] }), open && (_jsx("div", { className: "absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white/90 backdrop-blur shadow-lg p-2", style: { borderColor: "rgba(0,0,0,0.10)" }, children: SORT_OPTIONS.map((opt) => (_jsx("button", { type: "button", onClick: () => { onChange(opt.key); setOpen(false); }, className: "w-full rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-semibold transition hover:bg-black/5", style: { background: opt.key === selected.key ? "rgba(0,0,0,0.06)" : "transparent", color: "rgba(0,0,0,0.78)" }, children: _jsxs("span", { className: "inline-flex w-full items-center justify-between gap-3", children: [_jsx("span", { children: opt.label }), opt.key === selected.key && _jsx(Check, { className: "h-4 w-4 text-black/60" })] }) }, opt.key))) }))] }));
}
/* ------------------------------------------------------------------ */
/* Filter Sidebar                                                      */
/* ------------------------------------------------------------------ */
function FilterSidebar({ groups, activeFilters, toggleFilter }) {
    const [openGroups, setOpenGroups] = useState(() => groups.reduce((acc, g, idx) => { acc[g.key] = idx === 0; return acc; }, {}));
    return (_jsx("aside", { className: "flex flex-col gap-4", children: groups.map((group) => {
            const isOpen = !!openGroups[group.key];
            const activeValue = activeFilters[group.key] || "";
            return (_jsxs("div", { className: "rounded-2xl border bg-white/70 backdrop-blur", style: { borderColor: "rgba(0,0,0,0.08)" }, children: [_jsxs("button", { type: "button", onClick: () => setOpenGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] })), className: "w-full flex cursor-pointer items-center justify-between px-4 py-4 text-left text-sm font-semibold", children: [_jsx("span", { children: group.title }), _jsx(ChevronDown, { className: `h-4 w-4 text-black/50 transition-transform ${isOpen ? "rotate-180" : ""}` })] }), isOpen && (_jsx("div", { className: "px-4 pb-4", children: _jsxs("div", { className: "mt-1 flex flex-col gap-2", children: [_jsx("button", { type: "button", onClick: () => toggleFilter("", group.key), className: "text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition", style: { color: !activeValue ? "var(--text-inverse)" : "var(--text-primary)", background: !activeValue ? "var(--primary)" : "var(--surface)" }, children: "All" }), group.filters?.map((f) => (_jsx("button", { type: "button", onClick: () => toggleFilter(f, group.key), className: "text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition", style: { color: activeValue === f ? "var(--text-inverse)" : "var(--text-primary)", background: activeValue === f ? "var(--primary)" : "var(--surface)" }, children: capitalize(f) }, f)))] }) }))] }, group.key));
        }) }));
}
/* ------------------------------------------------------------------ */
/* Product Card                                                        */
/* ------------------------------------------------------------------ */
function ProductCard({ item, onClick, onAddToCart }) {
    const variants = item.raw?.usingVariant?.values ?? [];
    const price = item.price || "";
    const img = item.imageUrl;
    return (_jsxs("div", { onClick: onClick, className: "group text-left rounded-2xl border border-black/[0.06] bg-white overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-[340px] cursor-pointer", children: [_jsx("div", { className: "border-b border-black/[0.04] bg-black/[0.01]", children: _jsx("div", { className: "h-[150px] w-full relative overflow-hidden", children: _jsx("div", { className: "absolute inset-0 p-5", children: img ? (_jsx("img", { src: img, alt: item.title, className: "w-full h-full object-contain block transition-transform duration-300 group-hover:scale-105", draggable: false, loading: "lazy" })) : (_jsx("div", { className: "w-full h-full bg-black/[0.03] rounded-lg" })) }) }) }), _jsxs("div", { className: "p-4 flex flex-col flex-1 min-h-0", children: [variants.length > 0 ? (_jsxs("div", { className: "mb-3 flex flex-nowrap gap-x-1.5 overflow-hidden pb-1", children: [variants.slice(0, 4).map((v, i) => (_jsx("span", { className: "h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border max-w-[140px] truncate inline-flex items-center", style: {
                                    background: i === 0 ? "var(--primary)" : "transparent",
                                    color: i === 0 ? "white" : "var(--primary)",
                                    borderColor: i === 0 ? "rgba(0,0,0,0.10)" : "var(--primary)",
                                }, children: v }, v))), variants.length > 4 && (_jsxs("span", { className: "h-6 px-2 rounded-full text-[11px] font-semibold border inline-flex items-center", style: { color: "var(--primary)", borderColor: "var(--primary)" }, children: ["+", variants.length - 4] }))] })) : (_jsx("div", { className: "h-8 mb-3" })), _jsx("div", { className: "font-semibold leading-snug line-clamp-2 text-[15px]", children: item.title }), _jsx("div", { className: "mt-1.5 text-sm text-black/50 line-clamp-2 leading-relaxed", children: item.description }), _jsxs("div", { className: "mt-auto pt-4 flex items-center justify-between gap-3", children: [_jsx("div", { className: "text-lg font-bold", style: { color: "var(--primary)" }, children: price ? `$${price}` : "" }), _jsxs("button", { type: "button", className: "h-10 px-4 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.97]", style: { background: "var(--primary)", color: "white" }, onClick: (e) => { e.stopPropagation(); onAddToCart?.(); }, children: [_jsx(ShoppingCart, { className: "h-4 w-4" }), "Add"] })] })] })] }));
}
/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */
export default function ProductsPage({ items, filters = [], labels, siteData, slug, displayAs = 'cards' }) {
    const surface = siteData?.surface ?? "#ffffff";
    const primary = siteData?.primary ?? "#1a1a2e";
    const hasNoShipping = siteData?.businessInfo?.shipping === false;
    const [activeFilters, setActiveFilters] = useState({});
    const [sortKey, setSortKey] = useState("featured");
    const [localSearch, setLocalSearch] = useState("");
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [toast, setToast] = useState(null);
    const showToast = (name) => {
        setToast(`${name} added to cart`);
        setTimeout(() => setToast(null), 2500);
    };
    // Show detail view
    if (selectedProduct) {
        return (_jsx(ProductDetailView, { item: selectedProduct, surface: surface, primary: primary, siteData: siteData, onBack: () => setSelectedProduct(null), onAddToCart: (name) => showToast(name) }));
    }
    const toggleFilter = (value, groupKey) => {
        setActiveFilters((prev) => {
            const next = { ...prev };
            if (value)
                next[groupKey] = value;
            else
                delete next[groupKey];
            return next;
        });
    };
    return (_jsxs("div", { className: "min-h-[100dvh]", style: { background: surface }, children: [_jsxs("div", { className: "mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-24 mt-8", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl md:text-3xl font-semibold tracking-tight", children: labels?.title || "Products" }), _jsx("p", { className: "mt-1 text-sm text-black/60", children: labels?.subtitle || "Browse our collection and add your favorites to the cart." })] }), hasNoShipping && (_jsx("div", { className: "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium", style: { background: "var(--primary)", color: "var(--text-inverse)" }, children: _jsx("span", { className: "font-semibold", children: "Pickup only" }) }))] }), _jsxs("div", { className: "mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", children: [_jsx("div", { className: "flex-1", children: _jsx("input", { type: "text", value: localSearch, onChange: (e) => setLocalSearch(e.target.value), placeholder: "Search products... (press Enter)", className: "w-full h-11 px-4 rounded-2xl border border-black/10 bg-white/70 backdrop-blur text-sm focus:outline-none focus:ring-2 transition", style: { "--tw-ring-color": "var(--primary)" } }) }), _jsxs("div", { className: "hidden md:flex items-center gap-2", children: [_jsxs("button", { type: "button", className: "h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium transition hover:opacity-90 active:scale-95 cursor-pointer", style: { background: "var(--primary)", color: "var(--text-inverse)" }, children: [_jsx(Search, { className: "h-4 w-4" }), _jsx("span", { children: "Search" })] }), _jsx(SortDropdown, { value: sortKey, onChange: setSortKey })] }), _jsx("div", { className: "md:hidden", children: _jsx("button", { type: "button", className: "h-11 w-full rounded-2xl border bg-white/70 backdrop-blur px-4 text-sm font-semibold shadow-sm transition", style: { borderColor: "rgba(0,0,0,0.10)", color: "rgba(0,0,0,0.78)" }, children: _jsxs("span", { className: "inline-flex w-full items-center justify-center gap-2", children: [_jsx(SlidersHorizontal, { className: "h-4 w-4" }), _jsx("span", { children: "Filters & Sort" })] }) }) })] })] }), _jsx("div", { className: "mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-10 pb-10", children: _jsxs("div", { className: "grid gap-6 lg:grid-cols-12 items-start", children: [filters.length > 0 && (_jsx("div", { className: "hidden lg:block lg:col-span-2", children: _jsx(FilterSidebar, { groups: filters, activeFilters: activeFilters, toggleFilter: toggleFilter }) })), _jsxs("div", { className: filters.length > 0 ? "lg:col-span-10 min-w-0" : "lg:col-span-12 min-w-0", children: [items.length === 0 ? (_jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-8 text-center", children: [_jsx("div", { className: "text-base font-semibold", children: "No products found" }), _jsx("div", { className: "mt-1 text-sm text-black/50", children: "Try a different filter or search term." })] })) : displayAs !== 'cards' ? (_jsx(ContentRenderer, { items: items, displayAs: displayAs, slug: slug ?? 'products', accent: siteData?.primary ?? '#365b99' })) : (_jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: items.map((item) => (_jsx(ProductCard, { item: item, onClick: () => setSelectedProduct(item), onAddToCart: () => showToast(item.title) }, item.id))) })), items.length > 0 && (_jsxs("div", { className: "mt-3 text-center text-[12px] text-black/45", children: ["Showing 1\u2013", items.length, " of ", items.length, " products"] }))] })] }) }), toast && (_jsx("div", { className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in", children: _jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white px-5 py-3 shadow-xl flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full grid place-items-center", style: { background: primary, color: 'white' }, children: _jsx(ShoppingCart, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-sm font-medium", children: toast })] }) }))] }));
}
/* ------------------------------------------------------------------ */
/* Product Detail View                                                 */
/* ------------------------------------------------------------------ */
function ProductDetailView({ item, surface, primary, siteData, onBack, onAddToCart, }) {
    const variants = item.raw?.usingVariant?.values ?? [];
    const [selectedVariant, setSelectedVariant] = useState(variants[0] ?? '');
    const [quantity, setQuantity] = useState(1);
    const rawDesc = item.raw?.description;
    const desc = typeof rawDesc === 'object' && rawDesc && selectedVariant
        ? String(rawDesc[selectedVariant] ?? Object.values(rawDesc)[0] ?? '')
        : item.description;
    const rawPrice = item.raw?.price;
    const price = typeof rawPrice === 'object' && rawPrice && selectedVariant
        ? String(rawPrice[selectedVariant] ?? Object.values(rawPrice)[0] ?? '')
        : item.price;
    const rawImg = item.raw?.productImage;
    let img = item.imageUrl;
    if (rawImg && typeof rawImg === 'object' && selectedVariant) {
        const variantImg = rawImg[selectedVariant];
        if (variantImg?.source)
            img = variantImg.source;
    }
    const quantityOptions = item.raw?.quantityOptions ?? [1, 2, 3, 4, 5];
    const quantityUnit = item.raw?.quantityUnit ?? '';
    const hasNoShipping = siteData?.businessInfo?.shipping === false;
    const [detailToast, setDetailToast] = useState(null);
    const handleAdd = () => {
        onAddToCart?.(item.title);
        setDetailToast(`${item.title} added to cart`);
        setTimeout(() => setDetailToast(null), 2500);
    };
    return (_jsxs("div", { className: "min-h-[100dvh]", style: { background: surface }, children: [_jsxs("div", { className: "max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-24 md:pt-28 pb-16", children: [_jsx("button", { type: "button", onClick: onBack, className: "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-black/60 hover:text-black transition mb-8", children: "\u2190 Back to products" }), _jsxs("div", { className: "grid gap-8 lg:grid-cols-12", children: [_jsx("div", { className: "lg:col-span-7", children: _jsx("div", { className: "rounded-2xl border border-black/[0.06] bg-white overflow-hidden", children: _jsx("div", { className: "w-full h-[320px] sm:h-[400px] md:h-[520px] lg:h-[600px] flex items-center justify-center p-8 lg:p-12 bg-black/[0.01]", children: img ? (_jsx("img", { src: img, alt: item.title, className: "w-full h-full object-contain", draggable: false })) : (_jsx("div", { className: "w-full h-full bg-black/[0.03] rounded-lg" })) }) }) }), _jsx("div", { className: "lg:col-span-5", children: _jsx("div", { className: "lg:sticky lg:top-28", children: _jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white p-6 md:p-8", children: [_jsx("h1", { className: "text-2xl md:text-3xl font-bold tracking-tight leading-tight", children: item.title }), _jsxs("div", { className: "mt-3 text-2xl md:text-3xl font-bold", style: { color: primary }, children: ["$", price] }), _jsx("p", { className: "mt-4 text-sm md:text-[15px] text-black/55 leading-relaxed", children: desc }), variants.length > 0 && (_jsxs("div", { className: "mt-6", children: [_jsx("div", { className: "text-xs font-semibold text-black/50 uppercase tracking-wider mb-3", children: "Options" }), _jsx("div", { className: "flex flex-wrap gap-2", children: variants.map((v) => {
                                                            const active = (selectedVariant || variants[0]) === v;
                                                            return (_jsx("button", { type: "button", onClick: () => setSelectedVariant(v), className: "h-9 px-4 rounded-full text-xs cursor-pointer font-semibold border transition-all active:scale-[0.97]", style: {
                                                                    background: active ? primary : "transparent",
                                                                    color: active ? "white" : "rgba(0,0,0,0.65)",
                                                                    borderColor: active ? "transparent" : "rgba(0,0,0,0.1)",
                                                                }, children: v }, v));
                                                        }) })] })), _jsxs("div", { className: "mt-6", children: [_jsxs("div", { className: "text-xs font-semibold text-black/50 uppercase tracking-wider mb-3", children: ["Quantity", quantityUnit ? ` (${quantityUnit})` : ""] }), _jsx("div", { className: "inline-flex rounded-full border border-black/[0.08] bg-black/[0.01] overflow-hidden", children: quantityOptions.map((n) => (_jsx("button", { type: "button", onClick: () => setQuantity(n), className: "h-10 min-w-10 px-2 text-sm cursor-pointer font-semibold transition-all", style: {
                                                                background: quantity === n ? `${primary}15` : "transparent",
                                                                color: quantity === n ? primary : "rgba(0,0,0,0.5)",
                                                            }, children: n }, n))) })] }), _jsxs("div", { className: "mt-8 grid gap-3", children: [_jsxs("button", { type: "button", onClick: handleAdd, className: "h-12 rounded-full cursor-pointer text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2", style: { background: primary, color: "white" }, children: [_jsx(ShoppingCart, { className: "h-4 w-4" }), "Add to cart"] }), _jsx("button", { type: "button", className: "h-12 rounded-full cursor-pointer text-sm font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.02] transition-all active:scale-[0.98]", children: "Buy now" })] }), hasNoShipping && (_jsx("div", { className: "mt-4 text-center", children: _jsx("span", { className: "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", style: { background: `${primary}10`, color: primary }, children: "Pickup only" }) })), _jsx("div", { className: "mt-4 text-xs text-black/40 text-center", children: "Your cart is empty" })] }) }) })] })] }), detailToast && (_jsx("div", { className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in", children: _jsxs("div", { className: "rounded-2xl border border-black/[0.06] bg-white px-5 py-3 shadow-xl flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-full grid place-items-center", style: { background: primary, color: 'white' }, children: _jsx(ShoppingCart, { className: "h-4 w-4" }) }), _jsx("span", { className: "text-sm font-medium", children: detailToast })] }) }))] }));
}
