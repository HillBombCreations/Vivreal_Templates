/**
 * The business week the footer draws, or `null` (W25-5ca).
 *
 * The footer draws the site's `businessInfo.hours` only when they are the
 * site's ONE hours set. A site that also keeps hours of its own elsewhere
 * gets no footer week, because two answers to "when are you open" on one
 * screen is worse than one: Vesper Brewing's footer week matched none of its
 * three rooms nor its own "When we are open" block.
 *
 * Another hours set is:
 *   - a `locations` layout: each location draws its own hours and open-now
 *     line;
 *   - an `opening-hours` block that authors its own `labels.hours` (an empty
 *     one draws the business hours, so it is the same set).
 * Group children are walked. Absent hours draw nothing, as before.
 *
 * Pure, so it runs under `node --test`.
 */
import type { PageConfig, SiteData } from '@/types/SiteData';

interface HoursBlock {
  type?: { dispatchId?: string | null } | null;
  config?: { labels?: { hours?: unknown } | null; children?: unknown } | null;
}

function carriesOwnHours(blocks: readonly HoursBlock[] | null | undefined): boolean {
  for (const block of blocks ?? []) {
    if (!block) continue;
    const dispatchId = block.type?.dispatchId;
    if (dispatchId === 'locations') return true;
    const own = block.config?.labels?.hours;
    if (dispatchId === 'opening-hours' && Array.isArray(own) && own.some((line) => typeof line === 'string' && line.trim())) {
      return true;
    }
    const children = block.config?.children;
    // Cast: nested blocks share the shape; only the fields above are read, each optionally.
    if (Array.isArray(children) && carriesOwnHours(children as HoursBlock[])) return true;
  }
  return false;
}

export function footerHours(
  siteData: Pick<SiteData, 'businessInfo' | 'pageConfigs' | 'homePageConfig'> | null | undefined,
): NonNullable<SiteData['businessInfo']>['hours'] | null {
  const hours = siteData?.businessInfo?.hours ?? null;
  if (!hours) return null;
  const pages: (PageConfig | null | undefined)[] = [...(siteData?.pageConfigs ?? []), siteData?.homePageConfig];
  // Cast: a page's renderer `Block[]` carries the fields `HoursBlock` reads.
  return pages.some((page) => carriesOwnHours(page?.blocks as HoursBlock[] | undefined)) ? null : hours;
}
