/**
 * The PURE core of `collectBindingTargets` (./bindings.ts).
 *
 * Extracted to a sibling with no RUNTIME imports so it runs under
 * `node --test`, the same house lesson `./pageEmptiness.ts` records. Its
 * caller `./bindings.ts` imports `server-only` and `@/lib/api/siteData`,
 * neither of which resolves outside Next (`server-only` is not even installed:
 * Next provides it), so the prefetch collector could not be executed by a test
 * at all while it lived there. Measured 2026-09-30: importing `./bindings.ts`
 * under `node --experimental-strip-types` fails `ERR_MODULE_NOT_FOUND` on
 * `server-only`.
 *
 * Type-only imports are fine here: `--experimental-strip-types` erases them,
 * so neither specifier is resolved at runtime.
 */
import type { Block } from '@hillbombcreations/site-renderer';
import type { PageConfig } from '@/types/SiteData';

/**
 * The distinct data targets a page needs, flattened across every binding role.
 *
 * `buildPageContext` prefetches all of these in one `Promise.all`; `composePage`
 * re-buckets by role itself (in `buildSections`), so the builder only needs the
 * *union* of ids/types — role is irrelevant for the fetch step.
 */
export interface BindingTargets {
  /** Distinct collection group ids referenced by any binding (+ the products filter collection). */
  collectionIds: string[];
  /** Distinct integration types referenced by any binding, lower-cased. */
  integrationTypes: string[];
}

/**
 * The legacy role buckets, exactly as `getPageBindingsByRole` returns them.
 *
 * Passed IN rather than computed here so this module keeps no runtime import,
 * and so the legacy branch keeps that function's exact behaviour, including
 * that a binding carrying an unrecognised `role` lands in no bucket and is
 * therefore not collected. Recomputing the union from `page.collections`
 * directly would silently start collecting those.
 */
export interface PageBindingsByRole {
  primary: { collections: { collectionId?: string }[]; integrations: { type?: string; name?: string }[] };
  secondary: { collections: { collectionId?: string }[]; integrations: { type?: string; name?: string }[] };
  supplemental: { collections: { collectionId?: string }[]; integrations: { type?: string; name?: string }[] };
  sidebar: { collections: { collectionId?: string }[]; integrations: { type?: string; name?: string }[] };
}

/**
 * Walk a flat list of blocks (including recursive `group` children — D-B) and
 * accumulate all unique collectionIds and integrationProviders referenced.
 *
 * This is O(n) over the total number of blocks + bindings — block arrays are
 * small (single digits per page) so no Map/Set optimisation beyond dedup needed.
 */
function collectFromBlocks(
  blocks: Block[],
  collectionIds: Set<string>,
  integrationTypes: Set<string>,
): void {
  for (const block of blocks) {
    // Live CMS block data can omit `config` even though the published Block type
    // declares it required (e.g. coordinated-products group children authored
    // without a binding). Skip such blocks defensively — they contribute no
    // bindings and no children — rather than dereferencing `undefined.config`.
    // Mirrors the optional-chaining block reads in `getPageCollectionId`.
    const config = block?.config;
    if (!config) continue;

    // Recurse into group-kind children (D-B nesting: group blocks carry
    // config.children[] which are full Block objects mapped recursively).
    // Cast kind to string: 'group' is not in the published BlockKind union yet
    // (ph.0 adds it in the renderer source; published ^1.11.0 lacks it). The
    // cast is safe — unknown kinds are simply ignored by all other branches.
    if ((block.type?.kind as string) === 'group' && Array.isArray(config.children)) {
      collectFromBlocks(config.children as Block[], collectionIds, integrationTypes);
    }

    for (const binding of config.bindings ?? []) {
      if (binding.collectionId) {
        collectionIds.add(binding.collectionId);
      }
      if (binding.integrationProvider) {
        const t = binding.integrationProvider.toLowerCase();
        if (t) integrationTypes.add(t);
      }
    }
  }
}

/**
 * How deep `collectHeroCollectionIds` will walk. The deepest reference the
 * wire produces today is `hero.featureItem.collectionId` (depth 2); the cap is
 * headroom, not a limit anything real is near.
 *
 * It exists because this walks UNVALIDATED CMS data on every generic page
 * render, so "a weird hero cannot hang the response" has to be a property of
 * the walker and not an assumption about the data. It also makes a cyclic
 * object safe without paying for a visited-set on every render.
 */
const HERO_WALK_MAX_DEPTH = 6;

/**
 * Collect every collection id the page's HERO references.
 *
 * WHY THE HERO NEEDS ITS OWN ARM. `buildPageContext` fetches exactly the ids
 * this module returns and exposes them as `data.getItems(id)`. Until
 * kit-builds-2026-09 every hero variant took AUTHORED labels, so reading
 * `bindings[]` was enough. The `'feature-item'` variant (salon + live-events
 * kits) is the first hero whose lockup IS an item of a bound collection: the
 * renderer's `resolveFeatureItem` reads `page.hero.featureItem.collectionId`
 * and calls `getItems` on it. Uncollected, that returns `[]`, and an empty
 * list resolves to `undefined`, which falls back to the plain title lockup:
 * a 200 with a silently degraded hero and nothing red anywhere. It resolved
 * at all only on a page that ALSO bound the same collection for another
 * reason.
 *
 * WHY IT READS THE HERO AND NOT `featureItem` BY NAME. The hero is the one
 * page-level struct where variants author collection references outside
 * `bindings[]`, and the renderer is explicit that this is a beginning rather
 * than a one-off: "All twenty previously shipped variants take AUTHORED
 * labels; not one reads a collection, and that is the gap"
 * (vivreal-site-renderer master d2430d5, `src/types/SiteData.ts`, read
 * 2026-09-30). A collector keyed on the name `featureItem` would have to be
 * re-landed for the next such variant, and until it was, that variant would
 * ship this same silent empty hero. `collectionId` has exactly one meaning
 * anywhere in a hero, so matching the key generalises without guessing.
 *
 * NOT GATED ON `hero.variant`, deliberately. Gating would re-introduce the
 * per-variant coupling this arm exists to avoid, and it would have to be
 * widened by hand in this repo every time the renderer adds a content-reading
 * hero, including during the window where the renderer has shipped the
 * variant and Templates has not caught up. The cost of not gating is one
 * wasted collection fetch on a page that authors a hero `collectionId` for a
 * variant that does not read one, which the blueprint schema calls out as
 * schema-valid but rendering nothing. A wasted fetch on a misauthored page is
 * the cheaper failure than a blank hero on a correct one.
 *
 * IDS ARE TRIMMED, and that is load-bearing rather than tidiness. The renderer
 * reads the id through `heroText`, which trims
 * (`src/composition/resolveHero.ts:262`, same ref and date), then looks up
 * `getItems(trimmed)`. `buildPageContext` keys its map by whatever string this
 * function returns. Collect `' col_shows '` verbatim and the prefetch happens
 * under a key the renderer never asks for: the fetch cost is paid and the hero
 * still renders empty.
 */
function collectHeroCollectionIds(node: unknown, into: Set<string>, depth = 0): void {
  if (depth > HERO_WALK_MAX_DEPTH || node === null || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const entry of node) collectHeroCollectionIds(entry, into, depth + 1);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'collectionId') {
      // Only a non-blank string is an id. A blank one would poison the
      // prefetch with a `getCollectionItems('')` call and seed an empty-string
      // key in the map.
      if (typeof value === 'string' && value.trim()) into.add(value.trim());
      continue;
    }
    collectHeroCollectionIds(value, into, depth + 1);
  }
}

/**
 * Flatten a page's binding targets into the set of collection ids and
 * integration types it needs for prefetch.
 *
 * BLOCKS-FIRST (ph.1 KEYSTONE): when `page.blocks` is non-empty, enumerate
 * every block's `config.bindings[]` (including nested `group` children) to
 * derive the targets. This is the additive path for block-authored pages.
 *
 * LEGACY FALLBACK: when `page.blocks` is absent or empty, fall through to the
 * existing `getPageBindingsByRole` + `page.collectionId` path unchanged.
 * Both paths coexist until ph.7 drops the legacy data.
 *
 * Parity invariant: for any page that has been backfilled with blocks[], the
 * blocks-first path MUST resolve the SAME set of collectionIds and
 * integrationTypes as the legacy path did — verified by the ph.1 parity trace
 * in the implementation report and enforced in ph.3 by `parity.test.ts`.
 *
 * The blocks-first branch mirrors the renderer's `mapBlocks` binding reads; the
 * legacy fallback branch mirrors `buildSections`' role bucketing + `usePreviewData`'s
 * pending-binding scan (`SiteEditor/usePreviewData.ts`). Both are role-agnostic.
 *
 * @param page   the active page config
 * @param byRole `getPageBindingsByRole(page)` for the legacy branch, or `null`
 *               when the caller already knows the blocks-first branch applies.
 */
export function collectTargets(page: PageConfig, byRole: PageBindingsByRole | null): BindingTargets {
  const collectionIds = new Set<string>();
  const integrationTypes = new Set<string>();

  if (page.blocks?.length) {
    // ── BLOCKS-FIRST PATH ──────────────────────────────────────────────────────
    // Enumerate all block bindings (including group children). The legacy
    // page.collectionId is NOT separately added here: in a backfilled blocks[]
    // page the filter-collection binding is recorded on the products block's
    // config.bindings[1].collectionId (R2 — two bindings fused on one block),
    // so `collectFromBlocks` picks it up automatically.
    collectFromBlocks(page.blocks, collectionIds, integrationTypes);
  } else if (byRole) {
    // ── LEGACY FALLBACK PATH ───────────────────────────────────────────────────
    // Retained unchanged until ph.7 drops page.collections/integrations/collectionId.
    for (const role of ['primary', 'secondary', 'supplemental', 'sidebar'] as const) {
      for (const b of byRole[role].collections) {
        if (b.collectionId) collectionIds.add(b.collectionId);
      }
      for (const b of byRole[role].integrations) {
        const t = (b.type ?? b.name ?? '').toLowerCase();
        if (t) integrationTypes.add(t);
      }
    }

    // products filter collection lives on page.collectionId (NOT in a binding
    // in the legacy model) — add it explicitly so composePage's shapeFilters
    // can call getItems(page.collectionId).
    if (page.collectionId) collectionIds.add(page.collectionId);
  }

  // OUTSIDE the branch, on purpose. `page.hero` is a page-level field and the
  // renderer's hero resolver takes the PAGE, not the block config
  // (`resolveHero(ctx.page, …)`, vivreal-site-renderer master d2430d5
  // `src/composition/blocks.ts:1786`, read 2026-09-30), so a blocks-authored
  // page and a legacy one carry the hero's collection reference in the same
  // place. Putting this inside either branch would fix one and leave the other
  // rendering the empty hero.
  //
  // `page.hero` is passed as `unknown`: the Templates `PageHero` mirror
  // declares none of the kit-builds-2026-09 hero fields, and deliberately is
  // not being widened to, because the renderer has not published them
  // (`@hillbombcreations/site-renderer` 1.74.3 carries no `'feature-item'`),
  // and mirroring an unpublished shape is how a mirror drifts. The walk does
  // not need the type.
  collectHeroCollectionIds(page.hero, collectionIds);

  return {
    collectionIds: [...collectionIds],
    integrationTypes: [...integrationTypes],
  };
}
