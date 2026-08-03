/**
 * Two-axis detail-route design (§7.2 step 8)
 * (docs/projects/industry-example-site-templates/two-axis-detail-route-design.md).
 *
 * Resolves `detailPage.context` — ONE object from a second collection (e.g.
 * the location a treatment page is scoped to). An unresolvable context
 * degrades to "render without context" rather than 404 — a broken join must
 * never delete a page. See `contextOverlay.ts` for the (pure, unit-tested)
 * `overrides` application.
 *
 * Pulls in `getCollectionItems` (a `server-only` module), so this file is
 * itself server-only and is not unit-tested under plain `node --test`.
 */
import "server-only";
import { getCollectionItems } from "@/lib/api/collections";
import type { DetailContextConfig } from "@hillbombcreations/site-renderer";

/**
 * Fetch `contextConfig.collectionId` and find the ONE object whose
 * `raw[match.field] === match.value`. Absent config, unresolvable
 * collection, or no match ⇒ `undefined` — the caller renders without
 * context (§7.2 step 8).
 */
export async function resolveDetailContext(
  contextConfig: DetailContextConfig | undefined,
): Promise<Record<string, unknown> | undefined> {
  const collectionId = contextConfig?.collectionId;
  const field = contextConfig?.match?.field;
  const value = contextConfig?.match?.value;
  if (!collectionId || !field || typeof value !== "string") return undefined;

  // limit 100 mirrors every other detail-route pool fetch in this file family
  // (collection-list/menu) — location/context collections are small (tens,
  // not thousands) by construction (§12 — the editable surface stays at 28
  // objects for a 9-location vertical).
  const { items } = await getCollectionItems(collectionId, { limit: 100 });
  const hit = items.find((it) => (it.raw as Record<string, unknown> | undefined)?.[field] === value);
  return hit?.raw as Record<string, unknown> | undefined;
}
