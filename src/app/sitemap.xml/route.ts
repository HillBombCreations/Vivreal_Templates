import { enforceDynamicUnlessIsr } from '@/lib/renderGate';
import { loadSitemapEntries } from '@/lib/seo/loadSitemapEntries';
import { rootSitemapXml } from '@/lib/seo/sitemapXml';

// The page list (v5 search R4): the whole list while it has at most 1,000
// addresses, an index of /sitemaps/<n>.xml parts past that. A route rather
// than Next's sitemap.ts because generateSitemaps serves nothing at this
// address; see src/lib/seo/sitemapXml.ts.
//
// ISR migration Phase 3. `revalidate` MUST be a literal: Next 16 parses route
// segment config out of this file's source and hard-fails the build on any
// expression. Keep 300 in step with ISR_REVALIDATE_SECONDS
// (`src/lib/renderMode.ts`); `renderMode.test.ts` fails if they drift.
export const revalidate = 300;

export async function GET(): Promise<Response> {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`.
  await enforceDynamicUnlessIsr();
  const entries = await loadSitemapEntries();
  return new Response(rootSitemapXml(entries), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
