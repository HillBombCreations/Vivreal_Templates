/**
 * Items as they enter a detail page, the way the renderer's composition
 * enters a binding's items (`withBindingItems`, renderer 1.85.1): SYSTEM
 * values readable by name first (F-C16R, `withSystemValues`, the stored
 * top-level value winning), then the binding's field map (F-C28,
 * `applyFieldMap`).
 *
 * WHY TEMPLATES NEEDS THIS. Composed pages already get both from the renderer.
 * The detail route reads its pool itself (`lookupDetailItem`, the menu arm),
 * so without this an owner's list mapped as "Dish Name is the title" would
 * show the title on the list and an empty heading on the item's own page,
 * and a scope on a `_system`-only `section` would admit an item on the list
 * that the detail page 404s.
 *
 * WHICH MAP. The page's own binding to that collection: a page template's
 * first, then a layout's, as `pageDetailCollectionId` prefers them. No map
 * (every page today) returns the same items, so the page is byte-identical.
 *
 * Pure (the renderer's `/bindings` subpath imports no React), so it runs
 * under `node --test`.
 */
import { applyFieldMap, readFieldMap, withSystemValues, type FieldMap } from '@hillbombcreations/site-renderer/bindings';
import { allBlocks, itemBinding, type LinkPage } from './linkedItems.ts';

/** The field map the page's own binding to `collectionId` carries, if any. */
export function detailFieldMap(page: LinkPage, collectionId: string): FieldMap | undefined {
  const blocks = allBlocks(page.blocks);
  const ordered = [
    ...blocks.filter((b) => b.type?.kind === 'page-template'),
    ...blocks.filter((b) => b.type?.kind !== 'page-template'),
  ];
  for (const block of ordered) {
    const binding = itemBinding(block);
    if (binding?.collectionId !== collectionId) continue;
    const map = readFieldMap(binding.sectionConfig?.fieldMap);
    if (map) return map;
  }
  return undefined;
}

/** `items` with SYSTEM values readable and `fieldMap` applied; the same array when nothing changed. */
export function enterDetailItems<T extends { id: string; raw?: Record<string, unknown> }>(
  items: T[],
  fieldMap: FieldMap | undefined,
): T[] {
  let changed = false;
  const out = items.map((item) => {
    const lifted = withSystemValues(item);
    // Cast: `applyFieldMap` is typed over the renderer's ContentItem; it
    // spreads the item it is given, so this repo's extra fields survive.
    const mapped = applyFieldMap(lifted as never, fieldMap) as unknown as T;
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? out : items;
}
