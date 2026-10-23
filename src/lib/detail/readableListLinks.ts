/**
 * Readable show and team links straight from the lists (plan row T5 (4),
 * 2026-10-23).
 *
 * WHAT. T4 gave every show and team member a readable address
 * (`readableSegment.ts`, `/shows/hotshots-2fb644`) and made the id address a
 * permanent redirect to it. The lists still linked the id, so every click on a
 * What's On card or a team card cost a redirect. Renderer 1.89.0 (R1) links
 * those lists by `itemSegment(item, itemKeyField)`; this module hands it the
 * two things it reads:
 *   - each item stamped with its readable segment, as `_system.slug` (the
 *     SYSTEM location, F-C16R), on a COPY of the list for this render;
 *   - the binding's `sectionConfig.itemKeyField = 'slug'`, on a copy of the page.
 *
 * WHICH LISTS. Only a list whose links land on a `shows` or `team` page that
 * serves that collection, because only those detail arms resolve readable
 * segments. The landing page is worked out the way the renderer works it out
 * (`servingDetailRouteSlug`, the mirror in `linkedItems.ts`; a page template
 * links to its own page). If any list for a collection on this page lands
 * somewhere else, that collection is left alone (id links, which T4 redirects),
 * because the stamp is per collection and a generic detail route would 404 a
 * readable segment.
 *
 * WHY IT MATCHES THE ROUTE. The caller computes the segments with
 * `readableSegments` over the SAME read the detail route resolves against
 * (`getShowsRead` / `getTeamMembersRead`, same collection, same cache key), so
 * the address a card links is the address `resolveReadableSegment` serves
 * without a redirect. No segments (that read failed) means nothing changes.
 *
 * Pure (the renderer's `./bindings` subpath is plain JS), so it runs under
 * `node --test`.
 */
import { SYSTEM_FIELD_KEYS, SYSTEM_META_KEY, systemValue } from '@hillbombcreations/site-renderer/bindings';
import { pageDetailCollectionId } from './detailCollection.ts';
import { allBlocks, itemBinding, servingDetailRouteSlug, type LinkBinding, type LinkPage } from './linkedItems.ts';

/** The key field the readable lists link by (a SYSTEM key, so it reads `_system.slug`). */
export const READABLE_KEY_FIELD = 'slug';

export type ReadableKind = 'shows' | 'team';

interface ReadableBinding extends LinkBinding {
  sectionConfig?: (LinkBinding['sectionConfig'] & { itemKeyField?: unknown }) | null;
}

interface ReadableBlock {
  type?: { kind?: string | null; dispatchId?: string | null } | null;
  config?: { bindings?: readonly ReadableBinding[] | null; children?: unknown } | null;
}

/** The page shape read here. Structural, so the site's and the renderer's page types both fit. */
export interface ReadablePage extends Omit<LinkPage, 'detailPage' | 'blocks'> {
  detailPage?: { enabled?: boolean; itemCollectionId?: string; itemKeyField?: string } | null;
  blocks?: readonly ReadableBlock[] | null;
}

/** An item as the lists hold it. */
export interface ReadableListItem {
  id: string;
  raw?: Record<string, unknown>;
}

const SYSTEM_KEYS: ReadonlySet<string> = new Set(SYSTEM_FIELD_KEYS);

/** `shows` / `team` when `target`'s detail route resolves readable segments for `collectionId`. */
function readableKind(target: ReadablePage, collectionId: string): ReadableKind | null {
  if (target.slug === 'home' || target.format === 'home' || target.detailPage?.enabled === false) return null;
  if (target.format !== 'shows' && target.format !== 'team') return null;
  return pageDetailCollectionId(target) === collectionId ? target.format : null;
}

/**
 * The collections on `page` whose every detail link lands on a readable route,
 * with the kind of list the route reads. `pages` is every page of the site.
 */
export function readableLinkCollections(page: ReadablePage, pages: readonly ReadablePage[]): Map<string, ReadableKind> {
  const verdicts = new Map<string, ReadableKind | null>();
  // Cast: `allBlocks` walks the same structural block shape this module declares.
  for (const block of allBlocks(page.blocks as LinkPage['blocks']) as ReadableBlock[]) {
    const collectionId = itemBinding(block)?.collectionId;
    if (!collectionId) continue;
    // A page template links to its own page (the team grid), except the shows
    // template, which links to the serving page as layouts do (renderer
    // `blocks.ts`). Casts: `pages` holds the same structural page shape.
    const linksHere = block.type?.kind === 'page-template' && block.type.dispatchId !== 'shows';
    const targetSlug = linksHere ? page.slug : servingDetailRouteSlug(page as LinkPage, pages as readonly LinkPage[], collectionId);
    if (!targetSlug) continue; // no link is drawn, nothing to decide
    const target = targetSlug === page.slug ? page : pages.find((p) => p?.slug === targetSlug);
    const kind = target ? readableKind(target, collectionId) : null;
    const prior = verdicts.get(collectionId);
    verdicts.set(collectionId, prior === undefined || prior === kind ? kind : null);
  }
  const out = new Map<string, ReadableKind>();
  for (const [collectionId, kind] of verdicts) if (kind) out.set(collectionId, kind);
  return out;
}

/**
 * The key field the renderer will link `collectionId`'s items by on `page`: its
 * `detailPage.itemKeyField` when that applies to this collection (it outranks
 * a binding's own, renderer `resolveItemKeyField`), else the readable one.
 */
function effectiveKeyField(page: ReadablePage, collectionId: string): string {
  const dp = page.detailPage;
  if (dp?.itemKeyField && (!dp.itemCollectionId || dp.itemCollectionId === collectionId)) return dp.itemKeyField;
  return READABLE_KEY_FIELD;
}

/** The renderer's `itemSegment` reading of one key field, or `undefined`. */
function linkedValue(raw: Record<string, unknown> | undefined, keyField: string): string | undefined {
  const value = systemValue(raw, keyField);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** `item` linking by `segment` under `keyField`; the same object when it already does. */
function stampSegment<I extends ReadableListItem>(item: I, segment: string | undefined, keyField: string): I {
  if (!segment) return item;
  const current = linkedValue(item.raw, keyField);
  // Already links the segment, or links the id (no value) and the segment IS the id.
  if (current === segment || (current === undefined && segment === item.id)) return item;
  const raw = { ...(item.raw ?? {}) };
  const own = raw[keyField];
  if (SYSTEM_KEYS.has(keyField) && !(typeof own === 'string' && own.trim())) {
    // Cast: `_system` is the CMS's metadata object on `objectValue` (F-C16R).
    const bag = (raw[SYSTEM_META_KEY] ?? {}) as Record<string, unknown>;
    raw[SYSTEM_META_KEY] = { ...bag, [keyField]: segment };
  } else {
    // A stored top-level value the readable route does not use (not one path
    // step, or shared by two items): this render links the route's segment.
    raw[keyField] = segment;
  }
  return { ...item, raw };
}

/** `page` with every binding of `collectionIds` keyed by the readable field; the same object when none is. */
function withReadableKeyField<P extends ReadablePage>(page: P, collectionIds: ReadonlySet<string>): P {
  let changed = false;
  const mapBlocks = (blocks: readonly ReadableBlock[]): ReadableBlock[] =>
    blocks.map((block) => {
      if (!block?.config) return block;
      const bindings = block.config.bindings?.map((binding) => {
        if (!binding?.collectionId || !collectionIds.has(binding.collectionId)) return binding;
        if (binding.sectionConfig?.itemKeyField === READABLE_KEY_FIELD) return binding;
        changed = true;
        return { ...binding, sectionConfig: { ...(binding.sectionConfig ?? {}), itemKeyField: READABLE_KEY_FIELD } };
      });
      const children = Array.isArray(block.config.children) ? mapBlocks(block.config.children as ReadableBlock[]) : undefined;
      return {
        ...block,
        config: { ...block.config, ...(bindings ? { bindings } : {}), ...(children ? { children } : {}) },
      };
    });
  const blocks = mapBlocks(page.blocks ?? []);
  return changed ? { ...page, blocks } : page;
}

/**
 * `page` and its lists ready for readable links: each collection in
 * `segmentsByCollection` (id to segment, from `readableSegments`) gets its
 * items stamped and its bindings keyed. Collections with no segments, and
 * every other collection, are passed through as the same arrays; with nothing
 * to do, `page` and the map come back as given.
 */
export function applyReadableLinks<P extends ReadablePage, I extends ReadableListItem>(
  page: P,
  itemsByCollection: ReadonlyMap<string, I[]>,
  segmentsByCollection: ReadonlyMap<string, ReadonlyMap<string, string>>,
): { page: P; itemsByCollection: ReadonlyMap<string, I[]> } {
  const active = [...segmentsByCollection].filter(([, segments]) => segments.size > 0);
  if (active.length === 0) return { page, itemsByCollection };
  const items = new Map(itemsByCollection);
  for (const [collectionId, segments] of active) {
    const list = itemsByCollection.get(collectionId);
    if (!list) continue;
    const keyField = effectiveKeyField(page, collectionId);
    items.set(collectionId, list.map((item) => stampSegment(item, segments.get(item.id), keyField)));
  }
  return { page: withReadableKeyField(page, new Set(active.map(([collectionId]) => collectionId))), itemsByCollection: items };
}
