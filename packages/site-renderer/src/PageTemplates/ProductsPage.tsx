import { useState, useRef, useEffect } from "react";
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, ShoppingCart } from "lucide-react";
import type { ContentItem } from "../types/ContentItem";
import type { SiteData } from "../types/SiteData";
import ContentRenderer from "../ContentRenderer";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface Filter {
  title: string;
  key: string;
  filters?: string[];
}

interface ProductsPageProps {
  items: ContentItem[];
  filters?: Filter[];
  labels?: Record<string, unknown>;
  siteData?: SiteData;
  slug?: string;
  displayAs?: string;
}

const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "createdAt:desc", label: "Newest" },
  { key: "price:asc", label: "Price: Low → High" },
  { key: "price:desc", label: "Price: High → Low" },
  { key: "name:asc", label: "Name: A → Z" },
];

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/* ------------------------------------------------------------------ */
/* Sort Dropdown                                                       */
/* ------------------------------------------------------------------ */

function SortDropdown({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = SORT_OPTIONS.find((o) => o.key === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 backdrop-blur px-3 h-9 text-sm font-semibold shadow-sm transition hover:bg-white"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
      >
        <ArrowUpDown className="h-4 w-4 text-black/60" />
        <span className="text-black/70">Sort:</span>
        <span className="text-black">{selected.label}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white/90 backdrop-blur shadow-lg p-2" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => { onChange(opt.key); setOpen(false); }}
              className="w-full rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-semibold transition hover:bg-black/5"
              style={{ background: opt.key === selected.key ? "rgba(0,0,0,0.06)" : "transparent", color: "rgba(0,0,0,0.78)" }}
            >
              <span className="inline-flex w-full items-center justify-between gap-3">
                <span>{opt.label}</span>
                {opt.key === selected.key && <Check className="h-4 w-4 text-black/60" />}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Filter Sidebar                                                      */
/* ------------------------------------------------------------------ */

function FilterSidebar({ groups, activeFilters, toggleFilter }: { groups: Filter[]; activeFilters: Record<string, string>; toggleFilter: (value: string, groupKey: string) => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    groups.reduce((acc, g, idx) => { acc[g.key] = idx === 0; return acc; }, {} as Record<string, boolean>)
  );

  return (
    <aside className="flex flex-col gap-4">
      {groups.map((group) => {
        const isOpen = !!openGroups[group.key];
        const activeValue = activeFilters[group.key] || "";
        return (
          <div key={group.key} className="rounded-2xl border bg-white/70 backdrop-blur" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
            <button
              type="button"
              onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !prev[group.key] }))}
              className="w-full flex cursor-pointer items-center justify-between px-4 py-4 text-left text-sm font-semibold"
            >
              <span>{group.title}</span>
              <ChevronDown className={`h-4 w-4 text-black/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="px-4 pb-4">
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFilter("", group.key)}
                    className="text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition"
                    style={{ color: !activeValue ? "var(--text-inverse)" : "var(--text-primary)", background: !activeValue ? "var(--primary)" : "var(--surface)" }}
                  >
                    All
                  </button>
                  {group.filters?.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => toggleFilter(f, group.key)}
                      className="text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition"
                      style={{ color: activeValue === f ? "var(--text-inverse)" : "var(--text-primary)", background: activeValue === f ? "var(--primary)" : "var(--surface)" }}
                    >
                      {capitalize(f)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Product Card                                                        */
/* ------------------------------------------------------------------ */

function ProductCard({ item, onClick, onAddToCart }: { item: ContentItem; onClick?: () => void; onAddToCart?: () => void }) {
  const variants = (item.raw?.usingVariant as { values?: string[] } | undefined)?.values ?? [];
  const price = item.price || "";
  const img = item.imageUrl;

  return (
    <div
      onClick={onClick}
      className="group text-left rounded-2xl border border-black/[0.06] bg-white overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-[340px] cursor-pointer"
    >
      <div className="border-b border-black/[0.04] bg-black/[0.01]">
        <div className="h-[150px] w-full relative overflow-hidden">
          <div className="absolute inset-0 p-5">
            {img ? (
              <img src={img} alt={item.title} className="w-full h-full object-contain block transition-transform duration-300 group-hover:scale-105" draggable={false} loading="lazy" />
            ) : (
              <div className="w-full h-full bg-black/[0.03] rounded-lg" />
            )}
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 min-h-0">
        {variants.length > 0 ? (
          <div className="mb-3 flex flex-nowrap gap-x-1.5 overflow-hidden pb-1">
            {variants.slice(0, 4).map((v, i) => (
              <span
                key={v}
                className="h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border max-w-[140px] truncate inline-flex items-center"
                style={{
                  background: i === 0 ? "var(--primary)" : "transparent",
                  color: i === 0 ? "white" : "var(--primary)",
                  borderColor: i === 0 ? "rgba(0,0,0,0.10)" : "var(--primary)",
                }}
              >
                {v}
              </span>
            ))}
            {variants.length > 4 && (
              <span className="h-6 px-2 rounded-full text-[11px] font-semibold border inline-flex items-center" style={{ color: "var(--primary)", borderColor: "var(--primary)" }}>
                +{variants.length - 4}
              </span>
            )}
          </div>
        ) : (
          <div className="h-8 mb-3" />
        )}

        <div className="font-semibold leading-snug line-clamp-2 text-[15px]">{item.title}</div>
        <div className="mt-1.5 text-sm text-black/50 line-clamp-2 leading-relaxed">{item.description}</div>

        <div className="mt-auto pt-4 flex items-center justify-between gap-3">
          <div className="text-lg font-bold" style={{ color: "var(--primary)" }}>
            {price ? `$${price}` : ""}
          </div>
          <button
            type="button"
            className="h-10 px-4 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
            style={{ background: "var(--primary)", color: "white" }}
            onClick={(e) => { e.stopPropagation(); onAddToCart?.(); }}
          >
            <ShoppingCart className="h-4 w-4" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

export default function ProductsPage({ items, filters = [], labels, siteData, slug, displayAs = 'cards' }: ProductsPageProps) {
  const surface = siteData?.surface ?? "#ffffff";
  const primary = siteData?.primary ?? "#1a1a2e";
  const hasNoShipping = siteData?.businessInfo?.shipping === false;

  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState("featured");
  const [localSearch, setLocalSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ContentItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (name: string) => {
    setToast(`${name} added to cart`);
    setTimeout(() => setToast(null), 2500);
  };

  // Show detail view
  if (selectedProduct) {
    return (
      <ProductDetailView
        item={selectedProduct}
        surface={surface}
        primary={primary}
        siteData={siteData}
        onBack={() => setSelectedProduct(null)}
        onAddToCart={(name) => showToast(name)}
      />
    );
  }

  const toggleFilter = (value: string, groupKey: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (value) next[groupKey] = value;
      else delete next[groupKey];
      return next;
    });
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      {/* Header */}
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-24 mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {(labels?.title as string) || "Products"}
            </h1>
            <p className="mt-1 text-sm text-black/60">
              {(labels?.subtitle as string) || "Browse our collection and add your favorites to the cart."}
            </p>
          </div>
          {hasNoShipping && (
            <div className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium" style={{ background: "var(--primary)", color: "var(--text-inverse)" }}>
              <span className="font-semibold">Pickup only</span>
            </div>
          )}
        </div>

        {/* Search + Sort */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search products... (press Enter)"
              className="w-full h-11 px-4 rounded-2xl border border-black/10 bg-white/70 backdrop-blur text-sm focus:outline-none focus:ring-2 transition"
              style={{ "--tw-ring-color": "var(--primary)" } as React.CSSProperties}
            />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium transition hover:opacity-90 active:scale-95 cursor-pointer"
              style={{ background: "var(--primary)", color: "var(--text-inverse)" }}
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
            <SortDropdown value={sortKey} onChange={setSortKey} />
          </div>

          {/* Mobile filters button */}
          <div className="md:hidden">
            <button
              type="button"
              className="h-11 w-full rounded-2xl border bg-white/70 backdrop-blur px-4 text-sm font-semibold shadow-sm transition"
              style={{ borderColor: "rgba(0,0,0,0.10)", color: "rgba(0,0,0,0.78)" }}
            >
              <span className="inline-flex w-full items-center justify-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters & Sort</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-10 pb-10">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Desktop sidebar */}
          {filters.length > 0 && (
            <div className="hidden lg:block lg:col-span-2">
              <FilterSidebar groups={filters} activeFilters={activeFilters} toggleFilter={toggleFilter} />
            </div>
          )}

          {/* Product grid */}
          <div className={filters.length > 0 ? "lg:col-span-10 min-w-0" : "lg:col-span-12 min-w-0"}>
            {items.length === 0 ? (
              <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
                <div className="text-base font-semibold">No products found</div>
                <div className="mt-1 text-sm text-black/50">Try a different filter or search term.</div>
              </div>
            ) : displayAs !== 'cards' ? (
              <ContentRenderer
                items={items}
                displayAs={displayAs}
                slug={slug ?? 'products'}
                accent={siteData?.primary ?? '#365b99'}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <ProductCard key={item.id} item={item} onClick={() => setSelectedProduct(item)} onAddToCart={() => showToast(item.title)} />
                ))}
              </div>
            )}

            {/* Items count */}
            {items.length > 0 && (
              <div className="mt-3 text-center text-[12px] text-black/45">
                Showing 1–{items.length} of {items.length} products
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-3 shadow-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: primary, color: 'white' }}>
              <ShoppingCart className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product Detail View                                                 */
/* ------------------------------------------------------------------ */

function ProductDetailView({
  item,
  surface,
  primary,
  siteData,
  onBack,
  onAddToCart,
}: {
  item: ContentItem;
  surface: string;
  primary: string;
  siteData?: SiteData;
  onBack: () => void;
  onAddToCart?: (name: string) => void;
}) {
  const variants = (item.raw?.usingVariant as { name?: string; values?: string[] } | undefined)?.values ?? [];
  const [selectedVariant, setSelectedVariant] = useState<string>(variants[0] ?? '');
  const [quantity, setQuantity] = useState(1);

  const rawDesc = item.raw?.description;
  const desc = typeof rawDesc === 'object' && rawDesc && selectedVariant
    ? String((rawDesc as Record<string, string>)[selectedVariant] ?? Object.values(rawDesc)[0] ?? '')
    : item.description;

  const rawPrice = item.raw?.price;
  const price = typeof rawPrice === 'object' && rawPrice && selectedVariant
    ? String((rawPrice as Record<string, string>)[selectedVariant] ?? Object.values(rawPrice)[0] ?? '')
    : item.price;

  const rawImg = item.raw?.productImage;
  let img = item.imageUrl;
  if (rawImg && typeof rawImg === 'object' && selectedVariant) {
    const variantImg = (rawImg as Record<string, Record<string, string>>)[selectedVariant];
    if (variantImg?.source) img = variantImg.source;
  }

  const quantityOptions = (item.raw?.quantityOptions as number[]) ?? [1, 2, 3, 4, 5];
  const quantityUnit = (item.raw?.quantityUnit as string) ?? '';
  const hasNoShipping = siteData?.businessInfo?.shipping === false;
  const [detailToast, setDetailToast] = useState<string | null>(null);

  const handleAdd = () => {
    onAddToCart?.(item.title);
    setDetailToast(`${item.title} added to cart`);
    setTimeout(() => setDetailToast(null), 2500);
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-24 md:pt-28 pb-16">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-black/60 hover:text-black transition mb-8"
        >
          ← Back to products
        </button>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
              <div className="w-full h-[320px] sm:h-[400px] md:h-[520px] lg:h-[600px] flex items-center justify-center p-8 lg:p-12 bg-black/[0.01]">
                {img ? (
                  <img src={img} alt={item.title} className="w-full h-full object-contain" draggable={false} />
                ) : (
                  <div className="w-full h-full bg-black/[0.03] rounded-lg" />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 md:p-8">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">{item.title}</h1>
                <div className="mt-3 text-2xl md:text-3xl font-bold" style={{ color: primary }}>${price}</div>

                <p className="mt-4 text-sm md:text-[15px] text-black/55 leading-relaxed">{desc}</p>

                {variants.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-semibold text-black/50 uppercase tracking-wider mb-3">Options</div>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v) => {
                        const active = (selectedVariant || variants[0]) === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className="h-9 px-4 rounded-full text-xs cursor-pointer font-semibold border transition-all active:scale-[0.97]"
                            style={{
                              background: active ? primary : "transparent",
                              color: active ? "white" : "rgba(0,0,0,0.65)",
                              borderColor: active ? "transparent" : "rgba(0,0,0,0.1)",
                            }}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-6">
                  <div className="text-xs font-semibold text-black/50 uppercase tracking-wider mb-3">
                    Quantity{quantityUnit ? ` (${quantityUnit})` : ""}
                  </div>
                  <div className="inline-flex rounded-full border border-black/[0.08] bg-black/[0.01] overflow-hidden">
                    {quantityOptions.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(n)}
                        className="h-10 min-w-10 px-2 text-sm cursor-pointer font-semibold transition-all"
                        style={{
                          background: quantity === n ? `${primary}15` : "transparent",
                          color: quantity === n ? primary : "rgba(0,0,0,0.5)",
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="h-12 rounded-full cursor-pointer text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2"
                    style={{ background: primary, color: "white" }}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to cart
                  </button>
                  <button
                    type="button"
                    className="h-12 rounded-full cursor-pointer text-sm font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.02] transition-all active:scale-[0.98]"
                  >
                    Buy now
                  </button>
                </div>

                {hasNoShipping && (
                  <div className="mt-4 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: `${primary}10`, color: primary }}>
                      Pickup only
                    </span>
                  </div>
                )}

                <div className="mt-4 text-xs text-black/40 text-center">Your cart is empty</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {detailToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-3 shadow-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full grid place-items-center" style={{ background: primary, color: 'white' }}>
              <ShoppingCart className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{detailToast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
