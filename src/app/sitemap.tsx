import type { MetadataRoute } from 'next';
import { getSiteMap } from '@/lib/api/siteData';
import { enforceDynamicUnlessIsr } from '@/lib/renderGate';

// ISR migration Phase 3. `revalidate` MUST be a literal — Next 16 parses route
// segment config out of this file's source and hard-fails the build on any
// expression, so the SITE_RENDER_MODE gate cannot live here. It lives in the
// render, in `enforceDynamicUnlessIsr()`. Keep 300 in step with
// ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`); `renderMode.test.ts` fails
// if they drift.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`.
  await enforceDynamicUnlessIsr();
  const siteMap = await getSiteMap();

  if (Array.isArray(siteMap)) {
    return siteMap;
  }

  return [];
}