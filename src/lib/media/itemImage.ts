import 'server-only';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { getPageCollectionId } from '@/lib/api/siteData';
import { getShowsRead } from '@/lib/api/shows';
import { getTeamMembersRead } from '@/lib/api/team';
import { lookupDetailItem } from '@/lib/detail/lookupItem';
import { resolveStorefrontItemSummary } from '@/lib/detail/storefrontItem';
import { resolveReadableSegment } from '@/lib/detail/readableSegment';

/**
 * The signed URL of one item's primary picture, found ONLY in this site's own
 * content for the page the route names (discovery batch 3.10 item 15, see
 * `./stableImage.ts`). `undefined` when the page or item addresses nothing or
 * the item has no picture. The same lookups the detail page and its share card
 * use, in the same order.
 */
export async function itemImageSignedUrl(
  siteData: SiteData,
  page: PageConfig,
  itemId: string,
): Promise<string | undefined> {
  if (page.format === 'shows') {
    const { shows } = await getShowsRead(getPageCollectionId(siteData, page.name, process.env.SHOWS_ID || ''));
    const show = resolveReadableSegment(shows, itemId)?.item;
    return show?.imageUrl || show?.image || undefined;
  }
  if (page.format === 'team') {
    const { members } = await getTeamMembersRead(getPageCollectionId(siteData, page.name, process.env.TEAMMEMBERS_ID || ''));
    const member = resolveReadableSegment(members, itemId)?.item;
    return member?.imageUrl || member?.image || undefined;
  }
  if (page.format === 'products') {
    const summary = await resolveStorefrontItemSummary(siteData, page, itemId);
    if (summary) return summary.imageUrl;
  }
  return (await lookupDetailItem(siteData, page, itemId))?.item?.imageUrl || undefined;
}
