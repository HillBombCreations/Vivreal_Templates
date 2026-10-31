import "server-only";
import { getCollectionItems } from "@/lib/api/collections";
import { collectBindingTargets } from "@/lib/api/composition/bindings";
import type { PageConfig, SiteData } from "@/types/SiteData";

/**
 * Names for the services online booking offers (owner ideas T2). Since next
 * release 2026-11 (N3) VR_Client_API names a service whose item is public, and
 * `/book` asks here only for the ids it did not name. The name is read from
 * the site's own pages: every collection a page
 * binds is read through the same cached reader the pages render with (so this
 * costs no request a page has not already made), and an id found there takes
 * that item's title. Stops as soon as every id is named. An id found nowhere
 * is not offered (the page falls back to requests when none is).
 */
export async function resolveServiceNames(siteData: SiteData, ids: readonly string[]): Promise<Map<string, string>> {
  const wanted = new Set(ids);
  const names = new Map<string, string>();
  if (wanted.size === 0) return names;
  const collectionIds = new Set<string>();
  for (const page of siteData.pageConfigs ?? []) {
    for (const id of collectBindingTargets(page as PageConfig).collectionIds) collectionIds.add(id);
  }
  for (const collectionId of collectionIds) {
    const { items } = await getCollectionItems(collectionId, { limit: 100 });
    for (const item of items) {
      if (wanted.has(item.id) && item.title) names.set(item.id, item.title);
    }
    if (names.size === wanted.size) break;
  }
  return names;
}
