/**
 * detailCollection.ts — "which collection does this page serve?"
 *
 * ONE rule, and it has a twin: `Vivreal_Portal_Mobile`'s
 * `src/lib/sites/detailSource.ts`. The two are kept in agreement by a
 * cross-repo test that CALLS both against the same page shapes
 * (`Vivreal_Portal_Mobile/tests/unit/lib/sites/recipesDetailCollectionParity.test.ts`),
 * because three consumers ask this question — the detail route, the per-item
 * OG card, and the portal's Copy link button — and the first two live here
 * while the third lives there. When they disagree, the failure is a link the
 * portal offers and the site 404s.
 *
 * WHY IT IS NOT IN THE RENDERER, which is the obvious shared home and was the
 * first thing checked. Two findings against it:
 *   - The renderer has no page-level notion of this at all. Its binding read is
 *     PER BLOCK, inside `mapLayout` (`firstBinding(block)`), and there is
 *     nothing page-shaped to reuse. The rule below is derived from that read,
 *     not lifted from it.
 *   - This repo's only test runner is `node --experimental-strip-types --test`,
 *     and the renderer's package `exports` map publishes exactly two subpaths
 *     ("." and "./agent"). The root barrel pulls `next/link`, so plain Node
 *     cannot import it: a rule that lived there would be untestable from this
 *     side without ALSO adding a new subpath export, a publish, and a bump in
 *     both repos. The cost is real and the benefit is a test can already buy.
 *
 * Pure and dependency-free (no `server-only`, no `next/*`) for the reason
 * `detailFormats.ts` and `src/lib/seo/pageIndexing.ts` are: `siteData/index.tsx`
 * imports `server-only` and Sentry, so nothing inside it can ever be tested by
 * being CALLED. `getPageCollectionId` delegates here so it can be.
 */

/** One binding on a block, as far as data resolution cares. */
export interface DetailBindingLike {
  collectionId?: string | null;
  integrationProvider?: string | null;
}

/** One block on a page, as far as data resolution cares. */
export interface DetailBlockLike {
  type?: { kind?: string | null } | null;
  config?: { bindings?: readonly DetailBindingLike[] | null } | null;
}

/** The page shape this rule reads. Structural, so both repos' page types fit. */
export interface DetailPageLike {
  blocks?: readonly DetailBlockLike[] | null;
  /** Legacy pre-SP-7 mirror. */
  collectionId?: string | null;
  /** Legacy pre-SP-7 mirror. */
  collections?: readonly { collectionId?: string | null }[] | null;
}

/**
 * The collection a page's detail route addresses, or `undefined`.
 *
 * Resolution order, and every clause is load-bearing:
 *
 *   1. The first PAGE-TEMPLATE block's first binding carrying a `collectionId`.
 *      Unchanged, and first, because that is what every backfilled fleet page
 *      resolves through today.
 *   2. Legacy `page.collectionId`.
 *   3. Legacy `page.collections[0].collectionId`.
 *   4. The first CONTENT block whose FIRST binding carries a `collectionId`
 *      and no `integrationProvider`.
 *
 * CLAUSE 4 IS THE FIX, and its POSITION is the safety argument. Clauses 1-3 are
 * byte-identical to what shipped, and they run first, so every page that
 * resolved to a non-empty answer before resolves to the SAME answer now. This
 * is an additive superset: it can only turn `undefined` into a collection id,
 * never one id into another.
 *
 * WHY IT WAS NEEDED. `Vivreal_Portal_Mobile#346`'s Recipes preset seeds
 * `section-header` + `layout:cards` and deliberately NO `recipes` page-template
 * block (`mapPageTemplate` has no `recipes` arm, so the block composes to
 * nothing — a heading over empty space). That decision was right, and it left
 * clauses 1-3 with nothing to read: the auto-provisioned collection is bound to
 * the CARDS block. So every recipe URL 404'd, the per-item OG card fell back to
 * the page card, and the portal's Copy link button never rendered. Three
 * symptoms, this one cause.
 *
 * WHY `bindings[0]` AND NOT `bindings.find(b => b.collectionId)`. That is
 * exactly the renderer's own item-source read for a layout block —
 * `firstBinding(block)` in `composition/blocks.ts`, which checks
 * `integrationProvider` first and `collectionId` second. A products-shaped
 * block carries its FILTER collection at `bindings[1]`
 * (`[{integrationProvider,role:'primary'},{collectionId,role:'secondary'}]`),
 * and a `find` would serve detail out of the filter list. Reading index 0 and
 * skipping integration-sourced bindings mirrors the renderer instead of
 * guessing alongside it.
 *
 * TOP-LEVEL BLOCKS ONLY, no recursion into `config.children`. The only nested
 * binding in the estate is a coordinated Products group's grid child, and
 * `products` never reaches this rule: `servesCollectionDetail` does not claim
 * the format here, and the portal short-circuits it to
 * `detailIntegrationType` before calling this. Recursing would widen the blast
 * radius to buy nothing.
 */
export function pageDetailCollectionId(page: DetailPageLike): string | undefined {
  const blocks = page.blocks ?? [];

  const fromPageTemplate = blocks
    .find((b) => b?.type?.kind === 'page-template')
    ?.config?.bindings?.find((bd) => bd.collectionId)?.collectionId;
  if (fromPageTemplate) return fromPageTemplate;

  if (page.collectionId) return page.collectionId;
  const fromLegacyMirror = page.collections?.[0]?.collectionId;
  if (fromLegacyMirror) return fromLegacyMirror;

  for (const block of blocks) {
    // A block can legitimately carry no config at all (a masthead hero block's
    // empty config is dropped on a Mongo round-trip that strips empty
    // sub-objects) — mirrors `firstBinding`'s own optional chaining.
    const binding = block?.config?.bindings?.[0];
    if (!binding) continue;
    // Integration-sourced: the items come from Stripe/Square/Instagram, and any
    // collectionId alongside is a filter source, not an item source.
    if (binding.integrationProvider) continue;
    if (binding.collectionId) return binding.collectionId;
  }

  return undefined;
}
