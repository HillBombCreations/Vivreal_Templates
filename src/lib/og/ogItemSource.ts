/**
 * Which item `/og/<slug>/<itemId>` draws its card from (discovery batch 3.10
 * item 14, review 2026-10-23).
 *
 * The share card used to find an item only through `lookupDetailItem`, which
 * resolves the page's collection from its bindings. A shows page that relies
 * on the `SHOWS_ID` environment fallback has no binding, so the lookup found
 * nothing and every show on it shared the page's card instead of its poster.
 * Shows pages now read the shows list itself, from the same collection the
 * show page reads (`getPageCollectionId(..., SHOWS_ID)`), before falling back.
 *
 * The readers are injected, so the decision runs under `node --test`; the
 * route hands in the real ones.
 */
import type { OgCardItem } from './ogCard.ts';

export interface OgShowLike {
  id: string;
  title?: string;
  imageUrl?: string;
  image?: string;
}

export interface OgItemSources {
  /** The page's shows collection, binding first, then `SHOWS_ID` ('' when none). */
  showsCollectionId: string;
  readShows: (collectionId: string) => Promise<OgShowLike[]>;
  /** The storefront summary a products page's metadata uses. */
  storefrontSummary: () => Promise<OgCardItem | null>;
  /** The bound-collection lookup every other page uses. */
  lookup: () => Promise<OgCardItem | null | undefined>;
}

export async function resolveOgItem(
  format: string | undefined,
  itemId: string,
  sources: OgItemSources,
): Promise<OgCardItem | null | undefined> {
  if (format === 'products') {
    const summary = await sources.storefrontSummary();
    if (summary) return summary;
  }
  if (format === 'shows' && sources.showsCollectionId) {
    const show = (await sources.readShows(sources.showsCollectionId)).find((s) => s.id === itemId);
    if (show) return { title: show.title, imageUrl: show.imageUrl || show.image || undefined };
  }
  return sources.lookup();
}
