"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
import type { Product, Filter, SortOption } from "@/types/Products";
import ProductGrid from "./ProductGrid";
import MobileFilterSheet from "./MobileFilterSheet";

const DEBOUNCE_MS = 500;

const SORT_OPTIONS: SortOption[] = [
  { key: "featured", label: "Featured" },
  { key: "newest", label: "Newest" },
  { key: "priceAsc", label: "Price: Low \u2192 High" },
  { key: "priceDesc", label: "Price: High \u2192 Low" },
  { key: "nameAsc", label: "Name: A \u2192 Z" },
];

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface ProductsClientProps {
  products: Product[];
  filters: Filter[];
  labels: Record<string, string>;
  slug: string;
}

export default function ProductsClient({
  products,
  filters,
  labels,
  slug,
}: ProductsClientProps) {
  const router = useRouter();
  const siteData = useSiteData();

  const surface = siteData?.surface ?? "#ffffff";
  const businessInfo = siteData?.businessInfo;
  const hasNoShipping = businessInfo && businessInfo?.shipping === false;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSearchEffectRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterGroupType, setFilterGroupType] = useState(
    filters?.[0]?.key ?? ""
  );
  const [selectedVariants, setSelectedVariants] = useState<
    Record<string, string>
  >({});
  const [sortKey, setSortKey] = useState("featured");
  const [localSearch, setLocalSearch] = useState("");

  const replaceProductsQuery = (next: {
    filter?: string;
    filterType?: string;
    sort?: string;
    search?: string;
  }) => {
    const params = new URLSearchParams();

    if (next.filter?.trim() && next.filterType?.trim()) {
      params.set("filter", next.filter.trim());
      params.set("filterType", next.filterType.trim());
    }
    if (next.search?.trim()) params.set("search", next.search.trim());
    if (next.sort && next.sort !== "featured") params.set("sort", next.sort);

    const qs = params.toString();
    const url = qs ? `/${slug}?${qs}` : `/${slug}`;

    startTransition(() => router.replace(url));
  };

  const applyFilter = (value: string, groupKey: string) => {
    setFilterType(value);
    setFilterGroupType(groupKey);
    setLocalSearch("");
    skipNextSearchEffectRef.current = true;
    replaceProductsQuery({
      search: "",
      sort: sortKey,
      filter: value,
      filterType: groupKey,
    });
  };

  const applyMobileFilterSort = ({
    filterValue,
    filterGroupType: fgt,
    sortKey: sk,
  }: {
    filterValue: string;
    filterGroupType: string;
    sortKey: string;
  }) => {
    setSortKey(sk);
    setFilterType(filterValue);
    setFilterGroupType(fgt);
    setLocalSearch("");
    skipNextSearchEffectRef.current = true;
    replaceProductsQuery({
      search: "",
      sort: sk,
      filter: filterValue,
      filterType: fgt,
    });
  };

  const applySort = (value: string) => {
    setSortKey(value);
    replaceProductsQuery({
      search: localSearch,
      sort: value,
      filter: filterType,
      filterType: filterGroupType,
    });
  };

  const onSearch = (val: string) => {
    setLocalSearch(val);
    setFilterGroupType(filters?.[0]?.key ?? "");
    setFilterType("");
    replaceProductsQuery({
      search: val,
      sort: sortKey,
      filter: "",
      filterType: filters?.[0]?.key ?? "",
    });
  };

  // Debounced search
  useEffect(() => {
    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      onSearch(localSearch);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSearch]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const hasActiveFilter = !!filterType?.trim();
  const hasActiveSort = sortKey !== "featured";
  const hasActiveBlade = hasActiveFilter || hasActiveSort;
  const loading = isPending;

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
              placeholder="Search products..."
              className="w-full h-11 px-4 rounded-2xl border border-black/10 bg-white/70 backdrop-blur text-sm focus:outline-none focus:ring-2 transition"
              style={
                {
                  "--tw-ring-color": "var(--primary)",
                } as React.CSSProperties
              }
            />
          </div>

          {/* Desktop sort */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs font-semibold text-black/50">Sort:</span>
            <select
              value={sortKey}
              onChange={(e) => applySort(e.target.value)}
              disabled={loading}
              className="h-9 rounded-xl border border-black/10 bg-white/70 px-3 text-sm font-medium focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
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
                {hasActiveFilter ? `Filter: ${capitalize(filterType)}` : null}
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
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-black/50 uppercase tracking-wider">
                Types
              </h3>
              {filters.map((group) => (
                <div key={group.key} className="space-y-1">
                  <p className="text-sm font-semibold text-black/70">
                    {group.title}
                  </p>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => applyFilter("", group.key)}
                    className="block w-full text-left text-sm px-2 py-1 rounded-lg transition disabled:opacity-60"
                    style={{
                      fontWeight:
                        filterGroupType === group.key && filterType === ""
                          ? 700
                          : 400,
                      color:
                        filterGroupType === group.key && filterType === ""
                          ? "var(--primary)"
                          : "rgba(0,0,0,0.6)",
                    }}
                  >
                    All
                  </button>
                  {group.filters?.map((f) => {
                    const active =
                      filterGroupType === group.key && filterType === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        disabled={loading}
                        onClick={() => applyFilter(f, group.key)}
                        className="block w-full text-left text-sm px-2 py-1 rounded-lg transition disabled:opacity-60"
                        style={{
                          fontWeight: active ? 700 : 400,
                          color: active
                            ? "var(--primary)"
                            : "rgba(0,0,0,0.6)",
                        }}
                      >
                        {capitalize(f)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="lg:col-span-10 min-w-0">
            <ProductGrid
              products={products}
              selectedVariants={selectedVariants}
              setSelectedVariants={setSelectedVariants}
              slug={slug}
              loading={loading}
            />
          </div>
        </div>
      </div>

      <MobileFilterSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
        sortKey={sortKey}
        filterType={filterType}
        filterGroupType={filterGroupType}
        groups={filters}
        sortOptions={SORT_OPTIONS}
        loading={loading}
        onApply={applyMobileFilterSort}
        onClear={() =>
          applyMobileFilterSort({
            filterValue: "",
            filterGroupType: filters?.[0]?.key ?? "",
            sortKey: "featured",
          })
        }
      />
    </div>
  );
}
