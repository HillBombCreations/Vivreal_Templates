import { getSiteData } from '@/lib/api/siteData';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';
import { loadSitemapEntries } from '@/lib/seo/loadSitemapEntries';
import { rootSitemapXml } from '@/lib/seo/sitemapXml';

// The page list (v5 search R4): the whole list while it has at most 1,000
// addresses, an index of /sitemaps/<n>.xml parts past that. A route rather
// than Next's sitemap.ts because generateSitemaps serves nothing at this
// address; see src/lib/seo/sitemapXml.ts.
//
// Rendered per request, in every render mode (RW-4 follow-up). The page list
// reads the shell through the site version fence (`readerClassFor`, FULL), so a page
// the instance already serves is in the list on the first read after a save,
// and a failed probe never lists an older site. Under ISR (SITE_RENDER_MODE
// isr) it used to be cached for 300 s, so a new page stayed out of the list
// that long; with the gate unset it was already per request. The reads under
// it are still data-cached, and the fence's one probe per 5 s per instance is
// shared with every page and share image.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const [entries, siteData] = await Promise.all([loadSitemapEntries(), getSiteData()]);
  // Discovery batch 3.4, route layer: a demo's (empty) list is noindex even
  // when middleware's edge map was cold. See demoRobotsHeader.ts.
  return withDemoRobotsHeader(
    new Response(rootSitemapXml(entries), {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    }),
    isDemoSite(siteData),
  );
}
