import { enforceDynamicUnlessIsr } from '@/lib/renderGate';
import { loadSitemapEntries } from '@/lib/seo/loadSitemapEntries';
import { partSitemapXml } from '@/lib/seo/sitemapXml';

// One part of a page list past 1,000 addresses (v5 search R4), named by
// /sitemap.xml's index as /sitemaps/<n>.xml. A part that does not exist is a
// 404. See src/lib/seo/sitemapXml.ts.
//
// Keep 300 in step with ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`).
export const revalidate = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  await enforceDynamicUnlessIsr();
  const { file } = await params;
  const xml = partSitemapXml(await loadSitemapEntries(), file);
  if (xml === null) return new Response('Not found', { status: 404 });
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
