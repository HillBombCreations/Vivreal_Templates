/**
 * `/img/<slug>/<itemId>`, one item's primary picture at an address that never
 * expires (discovery batch 3.10 item 15). The picture is found in this site's
 * own content for the named page and item, never from anything the caller
 * sends; see `src/lib/media/stableImage.ts`.
 */
import { getSiteData } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { isPageTurnedOff } from '@/lib/pages/pageEnabled';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';
import { itemImageSignedUrl } from '@/lib/media/itemImage';
import { stableImageResponse } from '@/lib/media/stableImage';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> },
): Promise<Response> {
  const [{ slug, itemId }, siteData] = await Promise.all([params, getSiteData()]);
  if (siteData.degraded === true) return new Response('Try again shortly', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const page = getPageBySlug(siteData, slug);
  const signedUrl = page && !isPageTurnedOff(page) ? await itemImageSignedUrl(siteData, page, itemId) : undefined;
  return withDemoRobotsHeader(await stableImageResponse(signedUrl), isDemoSite(siteData));
}
