import 'server-only';

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
 * Flatten a page's role-bucketed bindings into the set of collection ids and
 * integration types it needs. Mirrors `usePreviewData`'s pending-binding scan
 * (`SiteEditor/usePreviewData.ts`) + `buildSections`' role bucketing, but
 * role-agnostic and reusing the existing `getPageBindingsByRole` helper so the
 * binding-shape knowledge stays in one place.
 *
 * Note: the products filter collection lives on `page.collectionId` (NOT a
 * binding), so it is added explicitly — `composePage`'s `shapeFilters` reads it
 * back via `getItems(page.collectionId)`.
 */
export function collectBindingTargets(page: PageConfig): BindingTargets {
  const byRole = getPageBindingsByRole(page);
  const collectionIds = new Set<string>();
  const integrationTypes = new Set<string>();

  for (const role of ['primary', 'secondary', 'supplemental', 'sidebar'] as const) {
    for (const b of byRole[role].collections) {
      if (b.collectionId) collectionIds.add(b.collectionId);
    }
    for (const b of byRole[role].integrations) {
      const t = (b.type ?? b.name ?? '').toLowerCase();
      if (t) integrationTypes.add(t);
    }
  }

  if (page.collectionId) collectionIds.add(page.collectionId);

  return {
    collectionIds: [...collectionIds],
    integrationTypes: [...integrationTypes],
  };
}
