"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ContentItem } from "@hillbombcreations/site-renderer";

/**
 * Shared live-interactivity adapters for the products storefront, used by BOTH
 * topologies so they cannot drift:
 *   - `ProductsPageComposed`        — the monolith page-template (B1 override).
 *   - `CoordinatedProductsComposed` — the atomized `group(coordinated:'products')`
 *     unit (G4 part ① override).
 *
 * Both render the SAME renderer storefront (the monolith composes
 * `<ProductsProvider><ProductsStorefront/></ProductsProvider>`; the coordinated
 * unit renders those parts directly with `slots`), so they need the IDENTICAL
 * controlled-query wiring: parse `f_<key>/search/sort` from the URL to seed the
 * controls (the server already filtered `items` by exactly those params), route
 * filter/sort/search changes back to the URL inside a transition (server
 * refetch), and route a card click to the detail page.
 *
 * This hook owns ONLY that wiring. Each component supplies its own `slug` +
 * `detailEnabled` (which differ between a monolith page and a coordinated unit
 * on a possibly-different slug) and renders its own provider tree, threading the
 * returned adapters.
 */

export const PRODUCTS_ITEMS_PER_PAGE = 15;

export interface ProductsLiveAdapters {
  /** Seed values parsed from the URL (the server already applied these to items). */
  initialFilters: Record<string, string>;
  initialSearch: string | undefined;
  initialSort: string | undefined;
  /** Items-per-page for client pagination (matches the legacy client). */
  itemsPerPage: number;
  /** True while a server refetch transition is pending (disables controls). */
  loading: boolean;
  /** Controlled-query callback: URL update + server refetch (no local filtering). */
  onQueryChange: (next: {
    filters: Record<string, string>;
    sort: string;
    search: string;
  }) => void;
  /** Card-click → route to the detail page, or `undefined` when detail is off. */
  onProductClick: ((item: ContentItem) => void) | undefined;
}

export function useProductsLiveAdapters(args: {
  slug: string;
  detailEnabled: boolean;
}): ProductsLiveAdapters {
  const { slug, detailEnabled } = args;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Seed the controls from the URL — the server already filtered `items` by
  // exactly these params (f_<key> / search / sort).
  const initialFilters: Record<string, string> = {};
  for (const [key, val] of searchParams.entries()) {
    if (key.startsWith("f_") && val) initialFilters[key.slice(2)] = val;
  }
  const initialSearch = searchParams.get("search") ?? undefined;
  const initialSort = searchParams.get("sort") ?? undefined;

  // Build f_<key>/search/sort params and router.replace inside a transition so
  // the renderer can disable controls while the server refetch is pending.
  const onQueryChange = (next: {
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
    // scroll: false — a filter/sort/search change must NOT reposition the
    // viewport. Without it, the App Router scrolls to the top on every
    // navigation, jarringly jumping the user back up on each filter click.
    startTransition(() =>
      router.replace(qs ? `/${slug}?${qs}` : `/${slug}`, { scroll: false }),
    );
  };

  return {
    initialFilters,
    initialSearch,
    initialSort,
    itemsPerPage: PRODUCTS_ITEMS_PER_PAGE,
    loading: isPending,
    onQueryChange,
    onProductClick: detailEnabled
      ? (item) => router.push(`/${slug}/${encodeURIComponent(item.id)}`)
      : undefined,
  };
}
