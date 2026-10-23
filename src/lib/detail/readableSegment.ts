/**
 * Readable addresses for show and team detail pages (discovery batch 3.10
 * item 13, 2026-10-22).
 *
 * WHAT CHANGED. A show or team member was addressed only by its database id,
 * `/shows/68fb126ce945a954f02fb644`. It now has a readable address:
 *   1. the item's CMS slug when it has one (`slug` on the record, else
 *      `_system.slug`), exactly as collection items are addressed; else
 *   2. its title (or name) in URL form plus the last six characters of its id,
 *      `/shows/hotshots-2fb644`. The id tail keeps two items with the same
 *      title apart, and keeps the address working after the title is edited.
 * The old id address answers a permanent redirect to the readable one.
 *
 * WHY THE FALLBACK EXISTS (a gap in the design, which assumed 1). Measured on
 * 2026-10-23 with a live read of The Comedy Collective: 0 of 14 shows and 0 of
 * 3 team members carry a CMS slug, so slugs alone would have changed no live
 * address at all.
 *
 * Pure (no `next/*`, no renderer import), so it runs under `node --test`.
 */

/** A readable item, in the shape both readers produce. */
export interface ReadableItem {
  id: string;
  /** The show title. */
  title?: string;
  /** The team member's name (used when there is no title). */
  name?: string;
  /** The record's CMS slug (`slug`, else `_system.slug`), when it has one. */
  cmsSlug?: string;
}

/**
 * The record's CMS slug as both readers see it: `slug` on the record first,
 * then `_system.slug` (the CMS keeps it as metadata, F-C16R), the same order
 * the renderer's `systemValue` reads for collection items.
 */
export function cmsSlugOf(objectValue: Record<string, unknown> | undefined): string | undefined {
  const top = objectValue?.slug;
  if (typeof top === 'string' && top.trim()) return top.trim();
  const system = objectValue?._system;
  const nested = system && typeof system === 'object' ? (system as Record<string, unknown>).slug : undefined;
  return typeof nested === 'string' && nested.trim() ? nested.trim() : undefined;
}

/** `{ cmsSlug }` when the record has one, else nothing at all (absent stays absent). */
export function cmsSlugField(objectValue: Record<string, unknown> | undefined): { cmsSlug?: string } {
  const cmsSlug = cmsSlugOf(objectValue);
  return cmsSlug ? { cmsSlug } : {};
}

const MONGO_ID = /^[0-9a-f]{24}$/;
const ID_TAIL = 6;
const MAX_TITLE_PART = 60;

/** `Monsignor Madness: Part II!` to `monsignor-madness-part-ii`. */
export function slugifyTitle(title: string | undefined): string {
  if (!title) return '';
  const folded = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // "Here's" reads "heres", not "here-s".
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return folded.slice(0, MAX_TITLE_PART).replace(/-+$/g, '');
}

/** A CMS slug usable as one path segment, or `undefined`. */
function usableCmsSlug(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(trimmed) ? trimmed : undefined;
}

/** The readable segment for one item, before the list-wide uniqueness check. */
function candidateSegment(item: ReadableItem): string {
  const cms = usableCmsSlug(item.cmsSlug);
  if (cms) return cms;
  const titlePart = slugifyTitle(item.title ?? item.name);
  if (!titlePart || !MONGO_ID.test(item.id)) return item.id;
  return `${titlePart}-${item.id.slice(-ID_TAIL)}`;
}

/**
 * The canonical segment of every item in one list, by id. A segment two items
 * would share (two equal CMS slugs, say) is not an address for either: both
 * keep their id, so a readable URL can never answer with the wrong item.
 */
export function readableSegments(items: readonly ReadableItem[]): Map<string, string> {
  const candidates = items.map((item) => [item.id, candidateSegment(item)] as const);
  const uses = new Map<string, number>();
  for (const [, segment] of candidates) uses.set(segment, (uses.get(segment) ?? 0) + 1);
  return new Map(candidates.map(([id, segment]) => [id, (uses.get(segment) ?? 0) > 1 ? id : segment]));
}

export type ReadableResolution<T> =
  | { item: T; segment: string; redirect: false }
  | { item: T; segment: string; redirect: true }
  | null;

/**
 * Which item a requested segment addresses, and whether the request must be
 * redirected to the item's canonical segment.
 *   - the canonical segment: serve it;
 *   - the item's id (every link before this change): redirect;
 *   - a stale readable segment whose id tail still names exactly one item (the
 *     title was edited since): redirect;
 *   - anything else: `null`, the caller's miss path.
 */
export function resolveReadableSegment<T extends ReadableItem>(
  items: readonly T[],
  requested: string,
): ReadableResolution<T> {
  const segments = readableSegments(items);
  for (const item of items) {
    const segment = segments.get(item.id) ?? item.id;
    if (requested === segment) return { item, segment, redirect: false };
  }
  const byId = items.find((item) => item.id === requested);
  if (byId) return { item: byId, segment: segments.get(byId.id) ?? byId.id, redirect: true };
  const tail = /-([0-9a-f]{6})$/.exec(requested)?.[1];
  if (tail) {
    const matches = items.filter((item) => MONGO_ID.test(item.id) && item.id.endsWith(tail));
    if (matches.length === 1) {
      const [item] = matches;
      return { item, segment: segments.get(item.id) ?? item.id, redirect: true };
    }
  }
  return null;
}
