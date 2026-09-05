/**
 * Pure decisions behind the two `/og/*` routes: which URL points at a card,
 * and what goes on it.
 *
 * Both routes are `.tsx` (they build an `ImageResponse`), which
 * `node --experimental-strip-types` cannot load at all, so everything here is
 * kept out of them and dependency-free — the same split
 * `src/components/JsonLd/schema.ts` and `src/lib/api/collections/mapItem.ts`
 * already use. The rendering half lives in `./ogCardRender.tsx`.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Cache the generated card / proxied image at the CDN so repeated crawler hits
 * don't regenerate or re-proxy on every request.
 */
export const OG_CACHE_CONTROL =
  'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Perceived-lightness check so card text stays legible on any brand color.
 * Standard luma weights; > 0.6 ⇒ treat as light (use dark text). Non-hex or
 * malformed input ⇒ treated as dark (white text), the safer default.
 */
export function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Build the Open Graph image URL for a PAGE. Always points at the dynamic
 * `/og/[slug]` route (a stable, non-expiring URL crawlers can cache). That
 * route proxies the page's Studio-uploaded image (`labels.ogImage`) when
 * present and otherwise generates a branded card — so the emitted `og:image`
 * never carries a short-lived signed media URL.
 */
export function buildOgImageUrl(origin: string, slug: string): string {
  return `${origin}/og/${encodeURIComponent(slug)}`;
}

/**
 * Build the Open Graph image URL for ONE ITEM under a page.
 *
 * Detail items used to inherit the parent page's card, because the only
 * builder took the page slug. Every recipe under `/recipes` therefore shared
 * one image (and, where the author had set a page-level SEO title, one title
 * too) — which defeats the entire point of pasting a recipe link into a
 * caption. The item id is in the path, so two items can never collide.
 *
 * The reason this is a route and not the item's own media URL is unchanged and
 * load-bearing: item media is a CloudFront-SIGNED URL with a finite TTL, and a
 * crawler re-fetches an `og:image` hours or days after it first saw it. The
 * route re-resolves and re-signs on every request, so ITS url never expires.
 */
export function buildOgItemImageUrl(
  origin: string,
  slug: string,
  itemId: string,
): string {
  return `${buildOgImageUrl(origin, slug)}/${encodeURIComponent(itemId)}`;
}

/** The minimum a page config has to carry for a card heading. */
export interface OgHeadingPage {
  name?: string;
  labels?: Record<string, string>;
  seo?: { metaTitle?: string };
}

/** Satori has no overflow handling worth relying on; cap the heading instead. */
const MAX_HEADING_LENGTH = 100;

/**
 * The heading a PAGE's generated card carries. Shared by both routes so the
 * per-item route's fallback card is identical to the one the page-level route
 * would have produced.
 */
export function resolvePageOgHeading(
  page: OgHeadingPage | undefined,
  fallbacks: { staticTitle?: string; siteName?: string; slug: string },
): string {
  return (
    page?.seo?.metaTitle ||
    page?.labels?.title ||
    page?.name ||
    fallbacks.staticTitle ||
    fallbacks.siteName ||
    fallbacks.slug
  ).slice(0, MAX_HEADING_LENGTH);
}

/** The shape `planOgItemCard` reads. A `ContentItem` satisfies it. */
export interface OgCardItem {
  title?: string;
  /** Already-signed CDN URL, as `toContentItem` resolves it. */
  imageUrl?: string;
}

/**
 * What the per-item OG route should return.
 *
 * `photo` — the item has its own picture; proxy those bytes.
 * `card`  — generate the branded card under `heading`.
 *
 * `heading` is carried on BOTH so a failed photo fetch still falls back to a
 * card naming the right item rather than the right page.
 */
export type OgItemCardPlan =
  | { kind: 'photo'; signedUrl: string; heading: string }
  | { kind: 'card'; heading: string };

/**
 * Decide the per-item card from the ITEM, falling back to the page only when
 * there is no item at all.
 *
 * The page fallback is deliberately narrow. An item with no photo still gets
 * its OWN generated card under its OWN title, because two photo-less recipes
 * sharing one card is the same defect this route exists to fix, just quieter.
 * The site-wide default share image (which the page-level route falls back to)
 * is skipped here for the same reason: it would put one image back on every
 * item.
 */
export function planOgItemCard(
  item: OgCardItem | undefined | null,
  pageHeading: string,
): OgItemCardPlan {
  const itemHeading = item?.title?.trim();
  const heading = (itemHeading || pageHeading).slice(0, MAX_HEADING_LENGTH);
  const imageUrl = item?.imageUrl?.trim();
  // `startsWith('http')` is the same reachability test the page-level route
  // applies before proxying: `getSignedUrl` returns '' for a non-media value.
  if (imageUrl && imageUrl.startsWith('http')) {
    return { kind: 'photo', signedUrl: imageUrl, heading };
  }
  return { kind: 'card', heading };
}
