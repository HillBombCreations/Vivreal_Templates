"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductsPage } from "@hillbombcreations/site-renderer";
import type {
  ContentItem,
  ProductsPageProps,
  SiteData as RendererSiteData,
} from "@hillbombcreations/site-renderer";
import { useSiteData } from "@/contexts/SiteDataContext";
import SiteRendererBridge from "@/components/SiteRendererBridge";

const ITEMS_PER_PAGE = 15;

/**
 * Live ProductsPage injected into composePage via `CompositionOptions.components`
 * (B1). composePage renders the BARE renderer `ProductsPage` (uncontrolled) for
 * the Studio preview; the live route injects THIS wrapper, which wires the
 * router-driven controlled query, detail navigation, cart, pagination and the
 * transition loading state.
 *
 * It receives the renderer's `ProductsPageProps` from `renderSection` — `items`
 * already mapped to `ContentItem[]` by the server-side product bridge, `filters`
 * already shaped. It seeds the controls from the URL (the server already applied
 * those same params to `items`) and routes filter/sort/search changes back to
 * the URL. This is the composePage analog of `ProductsPageClient`, which it
 * supersedes for migrated routes (legacy client kept as the rollback path).
 */
export default function ProductsPageComposed({
  items,
  filters,
  labels,
  slug = "",
  displayAs = "cards",
  detailEnabled = true,
  sectionConfig,
}: ProductsPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteData = useSiteData();
  const [isPending, startTransition] = useTransition();

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  // The server bridge leaves `imageUrl` undefined for products with no image
  // (it has no siteData server-side). Apply the same siteLogo fallback the
  // legacy ProductsPageClient did so cards never render a broken image.
  const itemsWithFallback: ContentItem[] = items.map((it) =>
    it.imageUrl ? it : { ...it, imageUrl: siteLogo },
  );

  // Seed the controls from the URL — the server already filtered `items` by
  // exactly these params (f_<key> / search / sort).
  const initialFilters: Record<string, string> = {};
  for (const [key, val] of searchParams.entries()) {
    if (key.startsWith("f_") && val) initialFilters[key.slice(2)] = val;
  }
  const initialSearch = searchParams.get("search") ?? undefined;
  const initialSort = searchParams.get("sort") ?? undefined;

  // Replicates the legacy ProductsPageClient query replacement: build
  // f_<key> / search / sort params and router.replace inside a transition so
  // the renderer can disable controls while the server refetch is pending.
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
    startTransition(() => router.replace(qs ? `/${slug}?${qs}` : `/${slug}`));
  };

  return (
    <SiteRendererBridge>
      <ProductsPage
        items={itemsWithFallback}
        filters={filters}
        labels={labels}
        slug={slug}
        displayAs={displayAs}
        sectionConfig={sectionConfig}
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
