"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import type { Product, Filter, SortOption } from "@/types/Products";
import ProductGrid from "./ProductGrid";
import MobileFilterSheet from "./MobileFilterSheet";
import AddedToCartToast from "./AddedToCartToast";

const SORT_OPTIONS: SortOption[] = [
  { key: "featured", label: "Featured" },
  { key: "createdAt:desc", label: "Newest" },
  { key: "price:asc", label: "Price: Low \u2192 High" },
  { key: "price:desc", label: "Price: High \u2192 Low" },
  { key: "name:asc", label: "Name: A \u2192 Z" },
];

const ITEMS_PER_PAGE = 15;

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function SortDropdown({
  value,
  options,
  loading,
  onChange,
}: {
  value: string;
  options: SortOption[];
  loading: boolean;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.key === value) ?? options[0];

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
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 backdrop-blur px-3 h-9 text-sm font-semibold shadow-sm transition hover:bg-white disabled:opacity-60"
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ArrowUpDown className="h-4 w-4 text-black/60" />
        <span className="text-black/70">Sort:</span>
        <span className="text-black">{selected?.label ?? "Select"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white/90 backdrop-blur shadow-lg p-2"
          style={{ borderColor: "rgba(0,0,0,0.10)" }}
        >
          {options.map((opt) => {
            const active = opt.key === selected?.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className="w-full rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-semibold transition hover:bg-black/5"
                style={{
                  background: active ? "rgba(0,0,0,0.06)" : "transparent",
                  color: "rgba(0,0,0,0.78)",
                }}
              >
                <span className="inline-flex w-full items-center justify-between gap-3">
                  <span>{opt.label}</span>
                  {active && <Check className="h-4 w-4 text-black/60" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterSidebar({
  groups,
  activeFilters,
  loading,
  toggleFilter,
}: {
  groups: Filter[];
  activeFilters: Record<string, string>;
  loading: boolean;
  toggleFilter: (value: string, groupKey: string) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    (groups || []).reduce((acc, g, idx) => {
      acc[g.key] = idx === 0;
      return acc;
    }, {} as Record<string, boolean>)
  );

  return (
    <aside className="flex flex-col gap-4">
      {groups.map((group) => {
        const isOpen = !!openGroups[group.key];
        const activeValue = activeFilters[group.key] || "";

        return (
          <div
            key={group.key}
            className="rounded-2xl border bg-white/70 backdrop-blur"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setOpenGroups((prev) => ({
                  ...prev,
                  [group.key]: !prev[group.key],
                }))
              }
              className="w-full flex cursor-pointer items-center justify-between px-4 py-4 text-left text-sm font-semibold disabled:opacity-60 disabled:pointer-events-none"
              aria-expanded={isOpen}
            >
              <span>{group.title}</span>
              <ChevronDown
                className={[
                  "h-4 w-4 text-black/50 transition-transform",
                  isOpen ? "rotate-180" : "rotate-0",
                ].join(" ")}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4">
                <div className="mt-1 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => toggleFilter("", group.key)}
                    disabled={loading}
                    className="text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition inline-flex items-center gap-2 disabled:opacity-60"
                    style={{
                      color: !activeValue
                        ? "var(--text-inverse)"
                        : "var(--text-primary)",
                      background: !activeValue
                        ? "var(--primary)"
                        : "var(--surface)",
                    }}
                  >
                    All
                  </button>

                  {group.filters?.map((f) => {
                    const active = activeValue === f;
                    return (
                      <button
                        key={`${group.key}-${f}`}
                        type="button"
                        disabled={loading}
                        onClick={() => toggleFilter(f, group.key)}
                        className="text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition inline-flex items-center gap-2 disabled:opacity-60"
                        style={{
                          color: active
                            ? "var(--text-inverse)"
                            : "var(--text-primary)",
                          background: active
                            ? "var(--primary)"
                            : "var(--surface)",
                        }}
                      >
                        {capitalize(f)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

interface ProductsClientProps {
  products: Product[];
  filters: Filter[];
  labels: Record<string, string>;
  slug: string;
  detailEnabled?: boolean;
  initialFilters?: Record<string, string>;
  initialSort?: string;
  initialSearch?: string;
}

export default function ProductsClient({
  products,
  filters,
  labels,
  slug,
  detailEnabled = true,
  initialFilters,
  initialSort,
  initialSearch,
}: ProductsClientProps) {
  const router = useRouter();
  const siteData = useSiteData();

  const surface = siteData?.surface ?? "#ffffff";
  const businessInfo = siteData?.businessInfo;
  const hasNoShipping = businessInfo && businessInfo?.shipping === false;

  const [isPending, startTransition] = useTransition();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(
    initialFilters ?? {}
  );
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >({});
  const [sortKey, setSortKey] = useState(initialSort || "featured");
  const [localSearch, setLocalSearch] = useState(initialSearch || "");
  const [page, setPage] = useState(1);
  const [addTick, setAddTick] = useState(0);

  // Sync state from server when URL params change on navigation
  const initialFiltersKey = JSON.stringify(initialFilters);
  useEffect(() => {
    setActiveFilters(initialFilters ?? {});
    setSortKey(initialSort || "featured");
    setLocalSearch(initialSearch || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiltersKey, initialSort, initialSearch]);

  // Reset to page 1 when products change
  useEffect(() => {
    setPage(1);
  }, [products]);

  const totalPages = Math.max(1, Math.ceil(products.length / ITEMS_PER_PAGE));
  const paginatedProducts = products.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  const replaceProductsQuery = (next: {
    filters?: Record<string, string>;
    sort?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();

    if (next.filters) {
      for (const [key, val] of Object.entries(next.filters)) {
        if (key && val) {
          params.set(`f_${key}`, val);
        }
      }
    }
    if (next.search?.trim()) params.set("search", next.search.trim());
    if (next.sort && next.sort !== "featured") params.set("sort", next.sort);

    const qs = params.toString();
    const url = qs ? `/${slug}?${qs}` : `/${slug}`;

    startTransition(() => router.replace(url));
  };

  const toggleFilter = (value: string, groupKey: string) => {
    const next = { ...activeFilters };
    if (value) {
      next[groupKey] = value;
    } else {
      delete next[groupKey];
    }
    setActiveFilters(next);
    setLocalSearch("");
    replaceProductsQuery({
      search: "",
      sort: sortKey,
      filters: next,
    });
  };

  const applyMobileFilterSort = ({
    filters: mobileFilters,
    sortKey: sk,
  }: {
    filters: Record<string, string>;
    sortKey: string;
  }) => {
    setSortKey(sk);
    setActiveFilters(mobileFilters);
    setLocalSearch("");
    replaceProductsQuery({
      search: "",
      sort: sk,
      filters: mobileFilters,
    });
  };

  const applySort = (value: string) => {
    setSortKey(value);
    replaceProductsQuery({
      search: localSearch,
      sort: value,
      filters: activeFilters,
    });
  };

  const onSearch = (val: string) => {
    setLocalSearch(val);
    setActiveFilters({});
    replaceProductsQuery({
      search: val,
      sort: sortKey,
      filters: {},
    });
  };

  const activeFilterCount = Object.keys(activeFilters).filter(
    (k) => activeFilters[k]
  ).length;
  const hasActiveFilter = activeFilterCount > 0;
  const hasActiveSort = sortKey !== "featured";
  const hasActiveBlade = hasActiveFilter || hasActiveSort;
  const loading = isPending;

  // Build summary label for active filters
  const filterSummary = Object.entries(activeFilters)
    .filter(([, v]) => v)
    .map(([, v]) => capitalize(v))
    .join(", ");

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      {/* Header */}
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-24 mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {labels?.title || "Products"}
            </h1>
            <p className="mt-1 text-sm text-black/60">
              {labels?.subtitle ||
                "Browse our collection and add your favorites to the cart."}
            </p>
          </div>

          {hasNoShipping && (
            <div
              className="inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium"
              style={{
                background: "var(--primary)",
                color: "var(--text-inverse)",
              }}
            >
              <span className="font-semibold">Pickup only</span>
              <span className="hidden sm:inline">
                Shipping is not available
              </span>
            </div>
          )}
        </div>

        {/* Search + Sort bar */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSearch(localSearch);
                }
              }}
              placeholder="Search products... (press Enter)"
              className="w-full h-11 px-4 rounded-2xl border border-black/10 bg-white/70 backdrop-blur text-sm focus:outline-none focus:ring-2 transition"
              style={
                {
                  "--tw-ring-color": "var(--primary)",
                } as React.CSSProperties
              }
            />
          </div>

          {/* Desktop search button + sort */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSearch(localSearch)}
              disabled={loading}
              className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium transition hover:opacity-90 active:scale-95 cursor-pointer disabled:opacity-60"
              style={{ background: "var(--primary)", color: "var(--text-inverse)" }}
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
              <span>Search</span>
            </button>
            <SortDropdown
              value={sortKey}
              options={SORT_OPTIONS}
              loading={loading}
              onChange={applySort}
            />
          </div>

          {/* Mobile filters button */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              className="h-11 w-full rounded-2xl border bg-white/70 backdrop-blur px-4 text-sm font-semibold shadow-sm transition active:scale-[0.99]"
              style={{
                borderColor: hasActiveBlade
                  ? "rgba(0,0,0,0.18)"
                  : "rgba(0,0,0,0.10)",
                background: hasActiveBlade
                  ? "rgba(0,0,0,0.03)"
                  : "rgba(255,255,255,0.70)",
                color: "rgba(0,0,0,0.78)",
              }}
            >
              <span className="inline-flex w-full items-center justify-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters & Sort</span>
                {hasActiveBlade && (
                  <span className="ml-1 inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    <span className="text-[12px] font-semibold text-black/60">
                      {hasActiveFilter && hasActiveSort
                        ? "Active"
                        : hasActiveFilter
                          ? "Filtered"
                          : "Sorted"}
                    </span>
                  </span>
                )}
              </span>
            </button>

            {hasActiveBlade && (
              <p className="mt-2 text-[11px] text-black/55">
                {hasActiveFilter ? `Filter: ${filterSummary}` : null}
                {hasActiveFilter && hasActiveSort ? " \u2022 " : null}
                {hasActiveSort
                  ? `Sort: ${SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? sortKey}`
                  : null}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-10 pb-10">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Desktop sidebar filters */}
          <div className="hidden lg:block lg:col-span-2">
            <FilterSidebar
              groups={filters}
              activeFilters={activeFilters}
              loading={loading}
              toggleFilter={toggleFilter}
            />
          </div>

          {/* Product grid + pagination */}
          <div className="lg:col-span-10 min-w-0">
            <ProductGrid
              products={paginatedProducts}
              selectedVariants={selectedVariants}
              setSelectedVariants={setSelectedVariants}
              slug={slug}
              loading={loading}
              detailEnabled={detailEnabled}
              onItemAdded={() => setAddTick((t) => t + 1)}
            />

            {/* Pagination */}
            {totalPages > 1 && !loading && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-9 px-3 rounded-xl border text-sm font-semibold transition hover:bg-black/5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className="h-9 w-9 rounded-xl text-sm font-semibold transition cursor-pointer"
                      style={{
                        background:
                          p === page ? "var(--primary)" : "transparent",
                        color:
                          p === page ? "var(--text-inverse)" : "rgba(0,0,0,0.7)",
                        border:
                          p === page ? "none" : "1px solid rgba(0,0,0,0.10)",
                      }}
                    >
                      {p}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-9 px-3 rounded-xl border text-sm font-semibold transition hover:bg-black/5 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  Next
                </button>
              </div>
            )}

            {/* Items count */}
            {products.length > 0 && !loading && (
              <div className="mt-3 text-center text-[12px] text-black/45">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(page * ITEMS_PER_PAGE, products.length)} of{" "}
                {products.length} products
              </div>
            )}
          </div>
        </div>
      </div>

      <MobileFilterSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
        sortKey={sortKey}
        activeFilters={activeFilters}
        groups={filters}
        sortOptions={SORT_OPTIONS}
        loading={loading}
        onApply={applyMobileFilterSort}
        onClear={() =>
          applyMobileFilterSort({
            filters: {},
            sortKey: "featured",
          })
        }
      />

      <AddedToCartToast addTick={addTick} />
    </div>
  );
}
