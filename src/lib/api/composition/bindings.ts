import 'server-only';

import type { PageConfig } from '@/types/SiteData';
import { getPageBindingsByRole } from '@/lib/api/siteData';
import { collectTargets, type BindingTargets } from './bindingTargets';

export type { BindingTargets };

/**
 * Flatten a page's binding targets into the set of collection ids and
 * integration types it needs for prefetch.
 *
 * The decision itself lives in `./bindingTargets.ts` (pure, `node --test`-able)
 * for the same reason `decidePageEmptiness` does: this module imports
 * `server-only` and `@/lib/api/siteData`, so nothing declared HERE can be
 * executed by a test. Keep this function a two-line adapter, because the
 * moment logic lands in it, that logic becomes untestable.
 *
 * `getPageBindingsByRole` is called only on the legacy branch, and only for its
 * role bucketing; see `PageBindingsByRole` for why the buckets are threaded
 * through rather than recomputed.
 */
export function collectBindingTargets(page: PageConfig): BindingTargets {
  return collectTargets(page, page.blocks?.length ? null : getPageBindingsByRole(page));
}
