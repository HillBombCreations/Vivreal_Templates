import 'server-only';

import type { Block } from '@hillbombcreations/site-renderer';
import type { PageConfig } from '@/types/SiteData';
import { getPageBindingsByRole } from '@/lib/api/siteData';

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
    // Recurse into group-kind children (D-B nesting: group blocks carry
    // config.children[] which are full Block objects mapped recursively).
    // Cast kind to string: 'group' is not in the published BlockKind union yet
    // (ph.0 adds it in the renderer source; published ^1.11.0 lacks it). The
    // cast is safe — unknown kinds are simply ignored by all other branches.
    if ((block.type.kind as string) === 'group' && Array.isArray(block.config.children)) {
      collectFromBlocks(block.config.children as Block[], collectionIds, integrationTypes);
    }

    for (const binding of block.config.bindings ?? []) {
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
 */
export function collectBindingTargets(page: PageConfig): BindingTargets {
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
  } else {
    // ── LEGACY FALLBACK PATH ───────────────────────────────────────────────────
    // Retained unchanged until ph.7 drops page.collections/integrations/collectionId.
    const byRole = getPageBindingsByRole(page);

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

  return {
    collectionIds: [...collectionIds],
    integrationTypes: [...integrationTypes],
  };
}
