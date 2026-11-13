import { getSiteData } from '@/lib/api/siteData';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';
import { loadSitemapEntries } from '@/lib/seo/loadSitemapEntries';
import { partNumber, partSitemapXml } from '@/lib/seo/sitemapXml';

// One part of a page list past 1,000 addresses (v5 search R4), named by
// /sitemap.xml's index as /sitemaps/<n>.xml. A part that does not exist is a
// 404. See src/lib/seo/sitemapXml.ts.
//
// Rendered per request through the site version fence, like /sitemap.xml
// (RW-4 follow-up; see that route).
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  // A name no part can have is a 404 without reading anything upstream.
  if (partNumber(file) === null) return new Response('Not found', { status: 404 });
  const [entries, siteData] = await Promise.all([loadSitemapEntries(), getSiteData()]);
  const xml = partSitemapXml(entries, file);
  if (xml === null) return new Response('Not found', { status: 404 });
  // Discovery batch 3.4, route layer. See demoRobotsHeader.ts.
  return withDemoRobotsHeader(
    new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }),
    isDemoSite(siteData),
  );
}
