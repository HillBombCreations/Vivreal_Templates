/**
 * W25f-2: item pages under a NESTED page, `/about/providers/<id>`.
 *
 * A depth-2 page is stored as one config with the slash in its slug
 * (`about/providers`, the alchemy43 blueprint's `format: "team"` roster on
 * Juniper, Meridian and salt + sage). `[slug]/[itemId]` serves that page,
 * because Next matches its URL as two segments, but each card on it links one
 * level deeper, and a 3-segment URL only ever reaches the `[...segments]`
 * catch-all, which used to answer every one of them with a redirect or a 404.
 *
 * This decides which 3-segment URLs are such an item page: the first two
 * segments must name a real page that `[slug]/[itemId]` itself serves (so not
 * a format in `NON_NESTABLE_FORMATS`, whose nested page already 404s; an item
 * URL only exists because the page above it does). The item route then takes
 * it with `slug` = the joined page slug and answers a missing item the way it
 * answers any other: the authored redirect, or a real 404.
 *
 * Pure, no `server-only`, so it runs under `node --test`.
 */

/**
 * Formats a depth-2 nested page never renders as: they need runtime component
 * overrides or their own interactive arms (see `[slug]/[itemId]/page.tsx`).
 */
export const NON_NESTABLE_FORMATS: ReadonlySet<string> = new Set([
  'products', 'schedule', 'subscribe',
  'checkout-success', 'checkout-cancel', 'home', 'shows',
]);

interface NestablePage {
  slug?: string;
  format?: string;
}

/** `{ slug, itemId }` for the item route when `segments` is an item under a served nested page, else `undefined`. */
export function nestedItemRoute(
  pageConfigs: readonly NestablePage[] | undefined,
  segments: readonly string[],
): { slug: string; itemId: string } | undefined {
  if (segments.length !== 3) return undefined;
  const [first, second, itemId] = segments;
  if (!first || !second || !itemId) return undefined;
  const slug = `${first}/${second}`;
  const page = pageConfigs?.find((p) => p.slug === slug);
  if (!page || NON_NESTABLE_FORMATS.has(page.format ?? '')) return undefined;
  return { slug, itemId };
}
