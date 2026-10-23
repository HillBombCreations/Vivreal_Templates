import 'server-only';
import { collectRichTextImageKeys } from '@hillbombcreations/site-renderer';
import type { PageConfig, SiteData } from '@/types/SiteData';
import { getPageCollectionId } from '@/lib/api/siteData';
import { getShowsRead } from '@/lib/api/shows';
import { getTeamMembersRead } from '@/lib/api/team';
import { lookupDetailItem } from '@/lib/detail/lookupItem';
import { resolveStorefrontItemSummaryRead } from '@/lib/detail/storefrontItem';
import { resolveReadableSegment } from '@/lib/detail/readableSegment';
import { richTextKeyForFile } from '@/lib/media/richTextImage';
import type { ItemImageRead } from '@/lib/media/stableImage';

/**
 * The signed URL of one item's primary picture, found ONLY in this site's own
 * content for the page the route names (discovery batch 3.10 item 15, see
 * `./stableImage.ts`), with whether the item was found and whether the read
 * behind it was degraded (`itemImageResponse` turns a degraded miss into a
 * 503, never a cacheable 404). The same lookups the detail page and its share
 * card use, in the same order.
 */
export async function itemImageSignedUrl(
  siteData: SiteData,
  page: PageConfig,
  itemId: string,
): Promise<ItemImageRead> {
  if (page.format === 'shows') {
    const { shows, degraded: showsDegraded } = await getShowsRead(getPageCollectionId(siteData, page.name, process.env.SHOWS_ID || ''));
    const show = resolveReadableSegment(shows, itemId)?.item;
    return { signedUrl: show?.imageUrl || show?.image || undefined, degraded: showsDegraded, itemFound: !!show };
  }
  if (page.format === 'team') {
    const { members, degraded: teamDegraded } = await getTeamMembersRead(getPageCollectionId(siteData, page.name, process.env.TEAMMEMBERS_ID || ''));
    const member = resolveReadableSegment(members, itemId)?.item;
    return { signedUrl: member?.imageUrl || member?.image || undefined, degraded: teamDegraded, itemFound: !!member };
  }
  let productsDegraded = false;
  if (page.format === 'products') {
    const { summary, degraded } = await resolveStorefrontItemSummaryRead(siteData, page, itemId);
    if (summary) return { signedUrl: summary.imageUrl, degraded, itemFound: true };
    productsDegraded = degraded;
  }
  const lookup = await lookupDetailItem(siteData, page, itemId);
  // `null` lookup: the page addresses no collection, a misconfiguration, not a read.
  return {
    signedUrl: lookup?.item?.imageUrl || undefined,
    degraded: productsDegraded || (lookup ? lookup.degraded : false),
    itemFound: !!lookup?.item,
  };
}

/**
 * The signed URL of one picture in a post body (BLOG2, `./richTextImage.ts`),
 * found ONLY among the keys stored in that item's own body, on the page the
 * route names, through the same lookup the detail page uses, with the same
 * found and degraded flags as `itemImageSignedUrl`.
 */
export async function richTextImageSignedUrl(
  siteData: SiteData,
  page: PageConfig,
  itemId: string,
  file: string,
): Promise<ItemImageRead> {
  const lookup = await lookupDetailItem(siteData, page, itemId);
  if (!lookup) return { degraded: false, itemFound: false };
  const item = lookup.item;
  if (!item) return { degraded: lookup.degraded, itemFound: false };
  const key = richTextKeyForFile(item.raw, file, collectRichTextImageKeys);
  return { signedUrl: key ? lookup.richTextImageUrls[key] : undefined, degraded: lookup.degraded, itemFound: true };
}
