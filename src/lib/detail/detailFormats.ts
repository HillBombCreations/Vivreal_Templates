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

/** The layout dispatchId a What's on listing is authored with. */
export const WHATS_ON_LAYOUT = 'whats-on';

/**
 * Layout dispatchIds that link every item to `/<pageSlug>/<itemId>` under
 * their OWN authority, on whatever page format they happen to sit on.
 *
 * WHY A SET AND NOT A FORMAT. Every other entry in `servesCollectionDetail`
 * keys off `page.format`, because every other detail-serving page type carries
 * a format of its own. A What's on page does not and deliberately so: the
 * portal preset persists `format: 'standard'` (`Vivreal_Portal_Mobile`'s
 * `src/data/pageTypePresets.ts`, the `whats-on` preset) because `'shows'`
 * would route un-blocked consumers to the legacy monolith the whole layout
 * exists to move off. The listing is a BLOCK, so the block is what has to be
 * read.
 *
 * WHY NOT JUST CLAIM `'standard'`. Around eighteen layouts emit a detail link
 * when `detailEnabled` (the renderer's `composition/blocks.ts` defaults it to
 * ON), so claiming `standard` wholesale would flip every standard page in the
 * fleet carrying any collection-bound layout from 404 to a rendered detail
 * page, all at once, on the next promote. That is a real change to live URLs
 * and it is not this feature's to make. Naming the one layout keeps the blast
 * radius to pages that actually carry it.
 *
 * ADD TO THIS SET ONLY WITH EVIDENCE that the layout emits item links AND that
 * `pageDetailCollectionId` can resolve the collection they point into.
 */
const DETAIL_LINKING_LAYOUTS: ReadonlySet<string> = new Set([WHATS_ON_LAYOUT]);

/**
 * One block on a page, as far as the detail-serving question cares.
 *
 * Carries `kind` as well as `dispatchId` so the shape mirrors
 * `DetailBlockLike` in `detailCollection.ts` and a real renderer `Block`
 * literal assigns without tripping excess-property checking. Only
 * `dispatchId` is read: a What's on listing is a `kind:'layout'` block
 * today, but pinning the kind here would make this rule go quietly blind if
 * the block is ever re-kinded, which is the failure mode the whole clause
 * exists to prevent.
 */
export interface DetailServingBlockLike {
  type?: { kind?: string | null; dispatchId?: string | null } | null;
}

/** The page shape `servesCollectionDetail` reads. Structural on purpose. */
export interface DetailServingPage {
  format?: string;
  detailPage?: { itemCollectionId?: string } | null;
  blocks?: readonly DetailServingBlockLike[] | null;
}

/**
 * Does this page's detail route resolve items out of a CMS collection?
 *
 * `[slug]/[itemId]/page.tsx` dispatches on format and falls through to
 * `notFound()` for anything it does not recognise — an unknown page FORMAT
 * hard-404s (unlike an unknown detail SECTION, which the renderer skips
 * silently). So a format that has no arm here does not degrade: every one of
 * its item URLs is a 404. `recipes` is listed for exactly that reason.
 *
 * The five clauses, in the order the route evaluates them:
 *   - `collection-list` — the original generic-collection arm.
 *   - `catalog`         — Storefront Phase 0.4 (D3). A catalog tile with no
 *                         authored order link now opens its item, which is an
 *                         ordinary collection object this arm already serves.
 *   - `recipes`         — a recipe is an ordinary collection object; the arm
 *                         serves it unchanged and passes the format straight
 *                         through to `DetailPageTemplate`, which resolves the
 *                         per-format section defaults.
 *   - any page carrying `detailPage.itemCollectionId` — the scoped-detail
 *                         opt-in, which is format-independent by design.
 *   - any page carrying a DETAIL-LINKING LAYOUT BLOCK (`whats-on`), the
 *                         block-level opt-in, and the only clause that reads
 *                         something other than the format. See
 *                         `DETAIL_LINKING_LAYOUTS` for why a What's on page
 *                         cannot be claimed by format.
 *
 * THE FAILURE THIS LAST CLAUSE FIXES is the Recipes defect one step on, and it
 * is currently WORSE than a plain 404 on a What's on page. `WhatsOnLayout`
 * emits `/<slug>/<id>` for every event whenever `detailEnabled` (default ON),
 * and `/og/[slug]/[itemId]` calls `lookupDetailItem` for ANY page with no
 * format gate at all. So a shared show link already resolves a correct social
 * card and then lands the visitor on a 404. Two symptoms, one cause.
 */
export function servesCollectionDetail(page: DetailServingPage): boolean {
  return (
    page.format === 'collection-list' ||
    page.format === 'catalog' ||
    page.format === RECIPES_FORMAT ||
    !!page.detailPage?.itemCollectionId ||
    hasDetailLinkingLayout(page.blocks)
  );
}

/**
 * Does this page carry a layout block that emits detail links on its own
 * authority, whatever the page format says?
 *
 * TOP-LEVEL BLOCKS ONLY, matching `pageDetailCollectionId` in
 * `detailCollection.ts`, which is the function that then has to resolve the
 * collection those links point into. A clause here that claimed a page that
 * one cannot resolve would turn a 404 into `answerItemMissing`, which is a
 * worse answer, not a better one.
 */
function hasDetailLinkingLayout(
  blocks: readonly DetailServingBlockLike[] | null | undefined,
): boolean {
  if (!blocks) return false;
  for (const block of blocks) {
    // A block can legitimately carry no `type` at all on a Mongo round-trip
    // that strips empty sub-objects. Mirrors the optional chaining in
    // `pageDetailCollectionId` and in the renderer's own `firstBinding`.
    const dispatchId = block?.type?.dispatchId;
    if (dispatchId && DETAIL_LINKING_LAYOUTS.has(dispatchId)) return true;
  }
  return false;
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
