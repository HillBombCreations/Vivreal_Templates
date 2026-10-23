/**
 * `/brand/logo`, the site's logo at an address that never expires (discovery
 * batch 3.10 item 15). Keyed by this site's record only; see
 * `src/lib/media/stableImage.ts` for why this is not a proxy.
 */
import { getSiteData } from '@/lib/api/siteData';
import { getSignedUrl } from '@/lib/api/media';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';
import { stableImageResponse } from '@/lib/media/stableImage';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const siteData = await getSiteData();
  if (siteData.degraded === true) return new Response('Try again shortly', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return withDemoRobotsHeader(await stableImageResponse(getSignedUrl(siteData.logo) || undefined), isDemoSite(siteData));
}
