/**
 * Read a whole list through VR_Client_API's paged reads (v5 search R4, "no
 * 100 cap").
 *
 * VR_Client_API answers at most 100 rows per read (`limit` max 100,
 * validators.js) with a `totalCount`, and takes `skip`. Every read here used
 * to ask for one page, so a shop's 101st product had no detail page (its card
 * linked to a 404) and no line in the page list. This keeps asking until it
 * has `totalCount` rows, a page comes back short, or `maxItems` is reached.
 *
 * Each page is its own cached read (the caller's), so a list of 150 costs two
 * cached reads, not one uncached one. A degraded page makes the whole answer
 * degraded: a list that is missing pages is not a list a caller may draw a
 * verdict from.
 *
 * Pure (no `server-only`), so it runs under `node --test`.
 */
export const CLIENT_API_PAGE_SIZE = 100;

/**
 * Upper bound on rows read for one list: 50 cached reads. Far above any fleet
 * list today; it bounds the cost of a runaway list rather than shaping a real
 * one, and the answer says when it was reached.
 */
export const READ_ALL_MAX_ITEMS = 5_000;

export interface PageRead<T> {
  items: T[];
  totalCount: number;
  degraded: boolean;
}

export interface AllPagesRead<T> {
  items: T[];
  totalCount: number;
  degraded: boolean;
  /** True when `maxItems` stopped the read before `totalCount`. */
  truncated: boolean;
  /** Reads made, for the caller's log line. */
  reads: number;
}

export async function readAllPages<T>(
  readPage: (skip: number, limit: number) => Promise<PageRead<T>>,
  { pageSize = CLIENT_API_PAGE_SIZE, maxItems = READ_ALL_MAX_ITEMS }: { pageSize?: number; maxItems?: number } = {},
): Promise<AllPagesRead<T>> {
  const items: T[] = [];
  let totalCount = 0;
  let degraded = false;
  let reads = 0;
  for (let skip = 0; skip < maxItems; skip += pageSize) {
    const page = await readPage(skip, Math.min(pageSize, maxItems - skip));
    reads += 1;
    degraded ||= page.degraded;
    totalCount = Math.max(totalCount, page.totalCount, items.length + page.items.length);
    items.push(...page.items);
    if (page.degraded || page.items.length < pageSize || items.length >= totalCount) break;
  }
  return { items, totalCount, degraded, truncated: items.length < totalCount && items.length >= maxItems, reads };
}
