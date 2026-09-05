/**
 * Which page formats the detail route (`src/app/[slug]/[itemId]/page.tsx`)
 * can actually serve, and which schema.org shape each one maps to.
 *
 * Extracted from the route rather than written inline for the reason the rest
 * of this repo already extracts its gates: `page.tsx` carries JSX, so
 * `node --experimental-strip-types` cannot load it at all and nothing inline
 * there can ever be tested by CALLING it (see `src/lib/seo/pageIndexing.ts`
 * and `src/lib/api/collections/mapItem.ts` for the same split).
 *
 * Pure, dependency-free (no `server-only`, no `next/*`) so it runs under plain
 * `node --test`.
 */

/** The page format a Recipes page is authored with. */
export const RECIPES_FORMAT = 'recipes';

/**
 * Does this page's detail route resolve items out of a CMS collection?
 *
 * `[slug]/[itemId]/page.tsx` dispatches on format and falls through to
 * `notFound()` for anything it does not recognise — an unknown page FORMAT
 * hard-404s (unlike an unknown detail SECTION, which the renderer skips
 * silently). So a format that has no arm here does not degrade: every one of
 * its item URLs is a 404. `recipes` is listed for exactly that reason.
 *
 * The three clauses, in the order the route evaluates them:
 *   - `collection-list` — the original generic-collection arm.
 *   - `recipes`         — a recipe is an ordinary collection object; the arm
 *                         serves it unchanged and passes the format straight
 *                         through to `DetailPageTemplate`, which resolves the
 *                         per-format section defaults.
 *   - any page carrying `detailPage.itemCollectionId` — the scoped-detail
 *                         opt-in, which is format-independent by design.
 */
export function servesCollectionDetail(page: {
  format?: string;
  detailPage?: { itemCollectionId?: string } | null;
}): boolean {
  return (
    page.format === 'collection-list' ||
    page.format === RECIPES_FORMAT ||
    !!page.detailPage?.itemCollectionId
  );
}

/**
 * The `format` discriminant to hand `buildDetailJsonLd` from the collection
 * arm.
 *
 * The arm serves several page formats and has always told the JSON-LD builder
 * `"products"` for all of them, so a `case 'recipes'` in that builder would be
 * dead code without this. Widening it to pass `pageConfig.format` VERBATIM was
 * rejected: every scoped-detail page on a non-recipes format (`location-hub`
 * and friends) would stop emitting Product/Thing and start emitting Article,
 * fleet-wide, on the next promote-stable. That is a real change to live
 * structured data and it is not this feature's to make.
 *
 * So: `recipes` maps to itself, everything else keeps today's `"products"`.
 */
export function detailJsonLdFormat(pageFormat: string | undefined): string {
  return pageFormat === RECIPES_FORMAT ? RECIPES_FORMAT : 'products';
}
