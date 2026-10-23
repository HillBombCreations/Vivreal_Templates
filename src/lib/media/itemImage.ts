import 'server-only';
import { collectRichTextImageKeys } from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { getPageCollectionId } from '@/lib/api/siteData';
import { getShowsRead } from '@/lib/api/shows';
import { getTeamMembersRead } from '@/lib/api/team';
import { lookupDetailItem } from '@/lib/detail/lookupItem';
import { resolveStorefrontItemSummary } from '@/lib/detail/storefrontItem';
import { resolveReadableSegment } from '@/lib/detail/readableSegment';
import { richTextKeyForFile } from '@/lib/media/richTextImage';

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

/**
 * The signed URL of one picture in a post body (BLOG2, `./richTextImage.ts`),
 * found ONLY among the keys stored in that item's own body, on the page the
 * route names, through the same lookup the detail page uses. `undefined` when
 * the item or the file addresses nothing.
 */
export async function richTextImageSignedUrl(
  siteData: SiteData,
  page: PageConfig,
  itemId: string,
  file: string,
): Promise<string | undefined> {
  const lookup = await lookupDetailItem(siteData, page, itemId);
  const item = lookup?.item;
  if (!lookup || !item) return undefined;
  const key = richTextKeyForFile(item.raw, file, collectRichTextImageKeys);
  return key ? lookup.richTextImageUrls[key] : undefined;
}
