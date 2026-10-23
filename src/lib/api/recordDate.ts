/**
 * A record's own timestamp as an ISO string, or `undefined` for anything that
 * is not a real date.
 *
 * Discovery batch 3.3 (gap 4): the shows, team and products readers carry the
 * record's `updatedAt` through, so the page list can say when each item last
 * changed instead of listing it with no date. A value that does not parse is
 * dropped, never passed through: a sitemap `lastmod` is a claim a crawler acts
 * on. Same rule as `sitemapDate` (`src/lib/seo/sitemap.ts`) and the collection
 * mapper's `isoDate`.
 *
 * Pure, so the readers and their tests load it under `node --test`.
 */
export function recordDate(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : undefined;
}

/**
 * `mapped` with the raw record's own `updatedAt` attached (absent when the
 * record has none). The one way the shows and team readers attach it, so the
 * U4 test can run it over records copied from a live read.
 */
export function withRecordDate<T extends object>(mapped: T, raw: { updatedAt?: unknown }): T & { updatedAt?: string } {
  const updatedAt = recordDate(raw.updatedAt);
  return updatedAt ? { ...mapped, updatedAt } : mapped;
}
