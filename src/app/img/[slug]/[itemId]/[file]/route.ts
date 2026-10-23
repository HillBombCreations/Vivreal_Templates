/**
 * `/img/<slug>/<itemId>/<file>`, one picture inside a post body at an address
 * that never expires (BLOG2, vivreal-hq design-blog-inline-images-2026-10-23.md).
 * The picture is found in this site's own content for the named page and item,
 * among the keys stored in that item's own body; `file` is a lookup key, never
 * a path. Same answer as `/img/<slug>/<itemId>` (`src/lib/media/stableImage.ts`):
 * long public cache, nosniff and the SVG sandbox, a 302 above 4 MB, a 404 for
 * anything it cannot find.
 */
import { getSiteData } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { isPageTurnedOff } from '@/lib/pages/pageEnabled';
import { servesCollectionDetail } from '@/lib/detail/detailFormats';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';
import { richTextImageSignedUrl } from '@/lib/media/itemImage';
import { itemImageResponse } from '@/lib/media/stableImage';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; itemId: string; file: string }> },
): Promise<Response> {
  const [{ slug, itemId, file }, siteData] = await Promise.all([params, getSiteData()]);
  if (siteData.degraded === true) return new Response('Try again shortly', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const page = getPageBySlug(siteData, slug);
  // Only a page whose detail route shows collection items (a blog, recipes)
  // renders a post body with stable picture addresses.
  // A degraded item read that found nothing is a 503 no-store, never a
  // cacheable 404 (`itemImageResponse`).
  const read =
    page && !isPageTurnedOff(page) && servesCollectionDetail(page)
      ? await richTextImageSignedUrl(siteData, page, itemId, file)
      : { degraded: false, itemFound: false };
  return withDemoRobotsHeader(await itemImageResponse(read), isDemoSite(siteData));
}
