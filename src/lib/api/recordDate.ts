/**
 * Discovery batch 3.3 (gap 4): the shows, team and products readers carry the
 * record's own `updatedAt` through, so the page list can say when each item
 * last changed instead of listing it with no date. The date rule is the page
 * list's own, `sitemapDate` (`src/lib/seo/sitemap.ts`): a value that does not
 * parse is dropped, never passed through.
 *
 * Pure, so the readers and their tests load it under `node --test`.
 */
import { sitemapDate } from '../seo/sitemap.ts';

/**
 * `mapped` with the raw record's own `updatedAt` attached (absent when the
 * record has none). The one way the shows and team readers attach it, so the
 * U4 test can run it over records copied from a live read.
 */
export function withRecordDate<T extends object>(mapped: T, raw: { updatedAt?: unknown }): T & { updatedAt?: string } {
  const updatedAt = sitemapDate(raw.updatedAt);
  return updatedAt ? { ...mapped, updatedAt } : mapped;
}
