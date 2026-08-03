/**
 * Two-axis detail-route design (§7.2 step 9) — the pure overlay half of
 * context resolution, split out of `resolveContext.ts` (which is
 * `server-only`) so it can be unit-tested under plain `node --test` (the
 * same "server-only lesson" `mapItem.ts` already follows in this directory's
 * sibling module).
 */

/**
 * Overlay `overrides` (itemField ← contextField) onto a CLONE of `item`.
 * Applied ONLY to the listed fields; everything else on the item is
 * untouched. Absent `context`/`overrides`, or a `contextField` the context
 * object doesn't carry, is a no-op for that field (never throws, never
 * deletes an item field it can't resolve).
 */
export function applyContextOverrides<T extends { raw?: Record<string, unknown> }>(
  item: T,
  context: Record<string, unknown> | undefined,
  overrides: Record<string, string> | undefined,
): T {
  if (!context || !overrides) return item;
  const entries = Object.entries(overrides).filter(([, contextField]) =>
    Object.prototype.hasOwnProperty.call(context, contextField),
  );
  if (entries.length === 0) return item;
  const overriddenRaw: Record<string, unknown> = { ...(item.raw ?? {}) };
  for (const [itemField, contextField] of entries) {
    overriddenRaw[itemField] = context[contextField];
  }
  return { ...item, raw: overriddenRaw };
}
