/**
 * Two-axis detail-route design (§7.2 step 6, T2)
 * (docs/projects/industry-example-site-templates/two-axis-detail-route-design.md).
 *
 * `_id` is tried FIRST, unconditionally — no existing detail URL can ever
 * change meaning. `itemKeyField` (when configured) is consulted only as a
 * fallback, so absent config is byte-identical to today's `_id`-only lookup.
 *
 * Shared by every arm that does its own item lookup: the collection-list /
 * scoped-detail arm and the menu arm (both cited in the design doc's T2 row).
 *
 * Pure, dependency-free (no `server-only`, no `next/*`) so it runs under
 * plain `node --test`.
 */
/**
 * Find `itemId` in `items`: exact `id === itemId` first, else
 * `raw[itemKeyField] === itemId` (string-exact, no fuzzy normalization — the
 * design doc explicitly rejects fuzzy matching as a way to silently resolve
 * the wrong item, §10).
 */
export function resolveItem<T extends { id: string; raw?: Record<string, unknown> }>(
  items: T[],
  itemId: string,
  itemKeyField?: string,
): T | undefined {
  const byId = items.find((it) => it.id === itemId);
  if (byId) return byId;
  if (!itemKeyField) return undefined;
  return items.find((it) => {
    const v = it.raw?.[itemKeyField];
    return typeof v === "string" && v === itemId;
  });
}

/**
 * §7.2 step 7 — the doorway-page guard. An item that resolves in the
 * UNSCOPED pool but not the scoped one is a hard 404 (never a redirect to
 * the unscoped page — that would invite crawling the full cross-product).
 * Returns `true` only when the item exists somewhere but was excluded by
 * the scope (the caller only needs to call this once the scoped lookup has
 * already missed).
 */
export function isDoorwayMiss<T extends { id: string; raw?: Record<string, unknown> }>(
  unscopedItems: T[],
  itemId: string,
  itemKeyField?: string,
): boolean {
  return resolveItem(unscopedItems, itemId, itemKeyField) !== undefined;
}
