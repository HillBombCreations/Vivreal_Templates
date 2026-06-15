"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProductsPage } from "@hillbombcreations/site-renderer";
import type {
  ContentItem,
  SiteData as RendererSiteData,
  ProductsPageFilter,
} from "@hillbombcreations/site-renderer";
import type { Product, Filter } from "@/types/Products";
import { useSiteData } from "@/contexts/SiteDataContext";
import { getSafeFieldValue } from "@/lib/utils/variantUtils";
import SiteRendererBridge from "@/components/SiteRendererBridge";

const ITEMS_PER_PAGE = 15;

interface ProductsPageClientProps {
  products: Product[];
  filters: Filter[];
  labels: Record<string, string>;
  slug: string;
  displayAs?: string;
  detailEnabled?: boolean;
  initialFilters?: Record<string, string>;
  initialSort?: string;
  initialSearch?: string;
}

/**
 * Thin client wrapper that adapts the server-component data flow to the
 * renderer's `ProductsPage`. Owns the router-driven query replacement
 * (`onQueryChange`) and the transition loading state so the server component
 * stays a pure data fetcher.
 *
 * Maps `Product[]` → `ContentItem[]`: the renderer resolves variant-keyed
 * fields itself (it reads `raw`), so we pass the full product through `raw`
 * and resolve only the default-variant scalars for the top-level display
 * fields — matching how `ProductGrid` builds ContentItems for the
 * `displayAs !== 'cards'` branch.
 */
export default function ProductsPageClient({
  products,
  filters,
  labels,
  slug,
  displayAs = "cards",
  detailEnabled = true,
  initialFilters,
  initialSort,
  initialSearch,
}: ProductsPageClientProps) {
  const router = useRouter();
  const siteData = useSiteData();
  const [isPending, startTransition] = useTransition();

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  const items: ContentItem[] = products.map((product) => {
    const defaultVariant = product.usingVariant?.values?.[0] ?? null;
    return {
      id: String(product._id ?? ""),
      title: getSafeFieldValue(product, "name", defaultVariant) ?? "",
      description: getSafeFieldValue(product, "description", defaultVariant) ?? "",
      imageUrl: getSafeFieldValue(product, "imageUrl", defaultVariant) || siteLogo,
      price: getSafeFieldValue(product, "price", defaultVariant) ?? undefined,
      source: "integration" as const,
      raw: product as unknown as Record<string, unknown>,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    };
  });

  // Replicates ProductsClient.replaceProductsQuery: build f_<key> / search /
  // sort params and router.replace, inside a transition for `loading`.
  const replaceProductsQuery = (next: {
    filters: Record<string, string>;
    sort: string;
    search: string;
  }) => {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(next.filters)) {
      if (key && val) params.set(`f_${key}`, val);
    }
    if (next.search?.trim()) params.set("search", next.search.trim());
    if (next.sort && next.sort !== "featured") params.set("sort", next.sort);

    const qs = params.toString();
    const url = qs ? `/${slug}?${qs}` : `/${slug}`;
    // scroll: false — preserve the user's scroll position across a filter/sort/
    // search change. The App Router default scrolls to top on navigation, which
    // jarringly jumps the viewport up on every filter click.
    startTransition(() => router.replace(url, { scroll: false }));
  };

  return (
    <SiteRendererBridge>
      <ProductsPage
        items={items}
        filters={filters as ProductsPageFilter[]}
        labels={labels}
        slug={slug}
        displayAs={displayAs}
        siteData={siteData as unknown as RendererSiteData}
        initialFilters={initialFilters}
        initialSort={initialSort}
        initialSearch={initialSearch}
        onQueryChange={replaceProductsQuery}
        itemsPerPage={ITEMS_PER_PAGE}
        loading={isPending}
        onProductClick={
          detailEnabled
            ? (item) => router.push(`/${slug}/${encodeURIComponent(item.id)}`)
            : undefined
        }
      />
    </SiteRendererBridge>
  );
}
