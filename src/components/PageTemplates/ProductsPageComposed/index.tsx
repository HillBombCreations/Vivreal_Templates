"use client";

import { ProductsPage } from "@hillbombcreations/site-renderer";
import type {
  ContentItem,
  ProductsPageProps,
  SiteData as RendererSiteData,
} from "@hillbombcreations/site-renderer";
import { useSiteData } from "@/contexts/SiteDataContext";
import SiteRendererBridge from "@/components/SiteRendererBridge";
import { useProductsLiveAdapters } from "@/components/PageTemplates/useProductsLiveAdapters";

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
 *
 * The controlled-query / detail-routing / pagination wiring is shared with the
 * atomized `CoordinatedProductsComposed` via `useProductsLiveAdapters`, so the
 * monolith and the coordinated topology stay byte-for-byte live-identical.
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
  const siteData = useSiteData();
  const adapters = useProductsLiveAdapters({ slug, detailEnabled });

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  // The server bridge leaves `imageUrl` undefined for products with no image
  // (it has no siteData server-side). Apply the same siteLogo fallback the
  // legacy ProductsPageClient did so cards never render a broken image.
  const itemsWithFallback: ContentItem[] = items.map((it) =>
    it.imageUrl ? it : { ...it, imageUrl: siteLogo },
  );

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
        initialFilters={adapters.initialFilters}
        initialSort={adapters.initialSort}
        initialSearch={adapters.initialSearch}
        onQueryChange={adapters.onQueryChange}
        itemsPerPage={adapters.itemsPerPage}
        loading={adapters.loading}
        onProductClick={adapters.onProductClick}
      />
    </SiteRendererBridge>
  );
}
