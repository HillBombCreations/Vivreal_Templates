"use client";

import {
  ProductsProvider,
  StorefrontShell,
} from "@hillbombcreations/site-renderer";
import type {
  ContentItem,
  CoordinatedProductsProps,
  ProductsPageFilter,
  SiteData as RendererSiteData,
} from "@hillbombcreations/site-renderer";
import { useSiteData } from "@/contexts/SiteDataContext";
import SiteRendererBridge from "@/components/SiteRendererBridge";
import { useProductsLiveAdapters } from "@/components/PageTemplates/useProductsLiveAdapters";

/**
 * Live wiring for the ATOMIZED products topology — `group(coordinated:'products')`.
 *
 * Injected into composePage via `CompositionOptions.components.CoordinatedProducts`
 * (G4 part ①). The renderer's coordinated arm (`renderGroup`) resolves the
 * products payload ONCE at the group boundary and hands THIS component
 * `{ shaped, slots, siteData }`; composePage renders the BARE
 * `<ProductsProvider><ProductsStorefront/></ProductsProvider>` (uncontrolled) for
 * the Studio preview, so the preview is unaffected.
 *
 * This is the coordinated-unit analog of `ProductsPageComposed` (the monolith
 * page-template override). It renders the SAME storefront parts the monolith
 * composes (`ProductsProvider` + `ProductsStorefront`) and threads the SAME live
 * adapters via `useProductsLiveAdapters` — so the monolith and the atomized
 * topology behave byte-for-byte identically on the live site (filter/sort/search
 * URL-sync + server refetch, detail routing, client pagination, cart).
 *
 * Two deltas vs `ProductsPageComposed`, both mandated by the coordinated model:
 *   1. It renders `ProductsProvider` + `StorefrontShell` DIRECTLY (not the
 *      monolith `ProductsPage`) so it can pass `slots` — it MUST forward `slots`
 *      so a hidden toolbar/filters/grid part stays hidden. It MUST NOT
 *      double-provider (the renderer arm no longer wraps it).
 *
 *      `StorefrontShell` — NOT `ProductsStorefront`. It IS `ProductsStorefront`
 *      (same component, same slots, no wrapper DOM) unless the grid binding
 *      names a kit shell via the exact literal `sectionConfig.shell`, in which
 *      case it renders that shell — the same lookup `ProductsPage` performs for
 *      the monolith topology. Importing `ProductsStorefront` here instead makes
 *      the LIVE site render the shared shell where the Studio preview (which
 *      goes through the renderer's own bare path) renders the kit's, i.e. a
 *      defect visible only after publish.
 *   2. It reads its inputs from `shaped` (the once-resolved payload) plus the
 *      group-level layout knobs `filterSide`/`gridColumns`/toolbar+filters config.
 */
export default function CoordinatedProductsComposed({
  shaped,
  slots,
}: CoordinatedProductsProps) {
  const siteData = useSiteData();
  const adapters = useProductsLiveAdapters({
    slug: shaped.slug,
    detailEnabled: shaped.detailEnabled,
  });

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  // Same image fallback the monolith composed wrapper applies — the server
  // product bridge leaves `imageUrl` undefined for products with no image.
  const itemsWithFallback: ContentItem[] = shaped.items.map((it) =>
    it.imageUrl ? it : { ...it, imageUrl: siteLogo },
  );

  return (
    <SiteRendererBridge>
      <ProductsProvider
        items={itemsWithFallback}
        filters={shaped.filters as ProductsPageFilter[]}
        labels={shaped.labels}
        siteData={siteData as unknown as RendererSiteData}
        slug={shaped.slug}
        displayAs={shaped.displayAs}
        detailEnabled={shaped.detailEnabled}
        sectionConfig={shaped.sectionConfig}
        showHeader={shaped.showHeader}
        filterSide={shaped.filterSide}
        gridColumns={shaped.gridColumns}
        toolbarConfig={shaped.toolbarConfig}
        filtersConfig={shaped.filtersConfig}
        initialFilters={adapters.initialFilters}
        initialSort={adapters.initialSort}
        initialSearch={adapters.initialSearch}
        onQueryChange={adapters.onQueryChange}
        itemsPerPage={adapters.itemsPerPage}
        loading={adapters.loading}
        onProductClick={adapters.onProductClick}
      >
        <StorefrontShell slots={slots} />
      </ProductsProvider>
    </SiteRendererBridge>
  );
}
