"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductsPageProps, SortOption } from "@/types/Products";
import { useSiteData } from "@/contexts/SiteDataContext";
import { capitalizeString } from "@/lib/utils/utils";
import ProductFilters from "./Filters";
import ProductsTable from "./ProductTable";
import ProductSearch from "./Search";
import ProductSort from "./Sort";
import { SlidersHorizontal } from "lucide-react";
import MobileFilterSortSheet from "./MobileFilterSortSheet";

const DEBOUNCE_MS = 500;

export default function ProductsPageClient({
  products,
  initialFilter,
  filters,
  search,
  sort,
  initialSelectedVariants,
}: ProductsPageProps) {
  const router = useRouter();
  const siteData = useSiteData();

  const SORT_OPTIONS: SortOption[] = [
    { key: "featured", label: "Featured" },
    { key: "newest", label: "Newest" },
    { key: "priceAsc", label: "Price: Low → High" },
    { key: "priceDesc", label: "Price: High → Low" },
    { key: "nameAsc", label: "Name: A → Z" },
  ];

  const surface = siteData?.siteDetails?.surface ?? "var(--surface,#ffffff)";
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl || "/vrlogo.png";

  const businessInfo = siteData?.businessInfo;
  const hasNoShipping = businessInfo && businessInfo?.shipping === false;

  const onMountedRef = useRef(false);
  const handleSearchRef = useRef(false);
  const skipNextSearchEffectRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>(initialFilter || "");
  const [filterGroupType, setFilterGroupType] = useState<string>(
    filters?.[0]?.key ?? ""
  );

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    initialSelectedVariants || {}
  );
  const [sortKey, setSortKey] = useState("featured");
  const [localSearch, setLocalSearch] = useState("");

  useEffect(() => {
    setFilterType(initialFilter || "");
    if (!filterGroupType && filters?.[0]?.key) setFilterGroupType(filters[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  useEffect(() => {
    setSelectedVariants((prev) => ({ ...(initialSelectedVariants || {}), ...prev }));
  }, [initialSelectedVariants]);

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
    const url = qs ? `/products?${qs}` : "/products";

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

  const applyMobileFilterSort = ({ filterValue, filterGroupType, sortKey }: { filterValue: string, filterGroupType: string, sortKey: string }) => {
    setSortKey(sortKey);
    setFilterType(filterValue);
    setFilterGroupType(filterGroupType);
    setLocalSearch("");
    skipNextSearchEffectRef.current = true;
    replaceProductsQuery({
      search: "",
      sort: sortKey,
      filter: filterValue,
      filterType: filterGroupType,
    });
  };


  const applySort = (value: string) => {
    setSortKey(value);
    setLocalSearch("");
    replaceProductsQuery({
      search: localSearch,
      sort: value,
      filter: filterType,
      filterType: filterGroupType,
    });
  };

  const onSearch = (val: string) => {
    setLocalSearch(val);
    setFilterGroupType(filters?.[0]?.key);
    setFilterType("");
    replaceProductsQuery({
      search: val,
      sort: sortKey,
      filter: "",
      filterType: filters?.[0]?.key,
    });
  };

  useEffect(() => {
    console.log('INSIDE SEARCH USE EFFECT');
    if (skipNextSearchEffectRef.current) {
      skipNextSearchEffectRef.current = false;
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!handleSearchRef.current && !!localSearch) {
      timerRef.current = setTimeout(() => {
        onSearch(localSearch);
      }, DEBOUNCE_MS);
      handleSearchRef.current = true;
      return;
    }

    if (handleSearchRef.current) {
      timerRef.current = setTimeout(() => {
        onSearch(localSearch);
      }, DEBOUNCE_MS);
      handleSearchRef.current = true;
      return;
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [localSearch]);

  

  useEffect(() => {
    if (!onMountedRef.current && search != null) {
      onMountedRef.current = true;
      skipNextSearchEffectRef.current = true;
      setLocalSearch(search);
    }
  }, [search]);

  useEffect(() => {
    if (!onMountedRef.current && sort) {
      onMountedRef.current = true;
      setSortKey(sort);
    }
  }, [sort, sortKey]);

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
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-24 mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Products</h1>
            <p className="mt-1 text-sm text-black/60">
              Browse our collection and add your favorites to the cart.
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
              <span className="hidden sm:inline">Shipping is not available</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <ProductSearch search={localSearch} loading={loading} setSearch={(v) => setLocalSearch(v)} onSearch={(v) => onSearch(v)} />
          </div>

          <div className="hidden md:flex justify-end">
            <ProductSort value={sortKey} options={SORT_OPTIONS} loading={loading} onChange={(k) => applySort(k)} />
          </div>

          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              className={`
                h-11 w-full rounded-2xl border bg-white/70 backdrop-blur
                px-4 text-sm font-semibold shadow-sm
                transition active:scale-[0.99]
              `}
              style={{
                borderColor: hasActiveBlade ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.10)",
                background: hasActiveBlade ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.70)",
                color: "rgba(0,0,0,0.78)",
              }}
            >
              <span className="inline-flex w-full items-center justify-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters & Sort</span>
                {hasActiveBlade ? (
                  <span className="ml-1 inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: "var(--primary)" }}
                    />
                    <span className="text-[12px] font-semibold text-black/60">
                      {hasActiveFilter && hasActiveSort ? "Active" : hasActiveFilter ? "Filtered" : "Sorted"}
                    </span>
                  </span>
                ) : null}
              </span>
            </button>

            {hasActiveBlade ? (
              <p className="mt-2 text-[11px] text-black/55">
                {hasActiveFilter ? `Filter: ${capitalizeString(filterType)}` : null}
                {hasActiveFilter && hasActiveSort ? " • " : null}
                {hasActiveSort ? `Sort: ${SORT_OPTIONS.find(o => o.key === sortKey)?.label ?? sortKey}` : null}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-10 pb-10">
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="hidden lg:block lg:col-span-2">
            <ProductFilters
              title="Types"
              groups={filters}
              filterType={filterType}
              loading={loading}
              applyFilter={applyFilter}
            />
          </div>

          <div className="lg:col-span-10 min-w-0">
            <ProductsTable
              products={products}
              selectedVariants={selectedVariants}
              setSelectedVariants={setSelectedVariants}
              siteLogo={siteLogo}
              loading={loading}
            />
          </div>
        </div>
      </div>

      <MobileFilterSortSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
        sortKey={sortKey}
        filterType={filterType}
        filterGroupType={filterGroupType}
        groups={filters}
        sortOptions={SORT_OPTIONS}
        loading={loading}
        onApply={(obj) => applyMobileFilterSort(obj)}
        onClear={() => applyMobileFilterSort({ filterValue: "", filterGroupType: filters?.[0]?.key, sortKey: "featured" })}
      />
    </div>
  );
}