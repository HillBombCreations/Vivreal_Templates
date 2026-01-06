"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter} from "next/navigation";
import { ProductsPageProps, SortOption } from "@/types/Products";
import { useSiteData } from "@/contexts/SiteDataContext";
import ProductFilters from "./Filters";
import ProductsTable from "./ProductTable";
import ProductSearch from "./Search";
import ProductSort from "./Sort";

export default function ProductsPageClient({
  products,
  initialFilter,
  filters,
  search,
  sort,
  initialSelectedVariants
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
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png";

  const businessInfo = siteData?.businessInfo;
  const hasNoShipping = businessInfo && businessInfo?.shipping === false;
  const onMountedRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const [filterType, setFilterType] = useState<string>(initialFilter || "");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    initialSelectedVariants || {}
  );
  const [sortKey, setSortKey] = useState("featured");
  const [localSearch, setLocalSearch] = useState("");

  useEffect(() => {
    setFilterType(initialFilter || "");
  }, [initialFilter]);

  useEffect(() => {
    setSelectedVariants((prev) => ({ ...(initialSelectedVariants || {}), ...prev }));
  }, [initialSelectedVariants]);

  const applyFilter = (value: string, type: string) => {
    setFilterType(value);
    const url = value ? `/products?filter=${encodeURIComponent(value)}&filterType=${encodeURIComponent(type)}` : "/products";
    startTransition(() => {
      router.replace(url);
    });
  };

  const applySort = (value: string) => {
    setSortKey(value);
    const url = value ? `/products?sort=${encodeURIComponent(value)}` : "/products";
    startTransition(() => {
      router.replace(url);
    });
  };
  

  const onSearch = (val: string) => {
    setLocalSearch(val);
    const url = val.trim() ? `/products?search=${encodeURIComponent(val)}` : "/products";

    startTransition(() => {
      router.replace(url);
    });
  };

  useEffect(() => {
    if (!localSearch && !onMountedRef.current && search) {
      onMountedRef.current = true;
      setLocalSearch(search);
    }
  }, [search, localSearch]);

  useEffect(() => {
    if (!onMountedRef.current && sort) {
      onMountedRef.current = true;
      setSortKey(sort);
    }
  }, [sort, sortKey]);

  const loading = isPending;
  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      <div className="mx-4 md:mx-10 lg:mx-20 pt-20 md:pt-24 mt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Products
            </h1>
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
              <span className="hidden sm:inline">
                Shipping is not available
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <ProductSearch
              initialValue={localSearch}
              loading={loading}
              onSearch={(v) => onSearch(v)}
            />
          </div>

          <div className="flex justify-end">
            <ProductSort
              value={sortKey}
              options={SORT_OPTIONS}
              loading={loading}
              onChange={(k) => applySort(k)}
            />
          </div>
        </div>
      </div>

      <div className="mx-4 md:mx-10 lg:mx-20 mt-8 pb-16">
        <div className="grid gap-6 lg:grid-cols-12">
          <ProductFilters
            title="Types"
            groups={filters}
            filterType={filterType}
            loading={loading}
            applyFilter={applyFilter}
          />

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
  );
}