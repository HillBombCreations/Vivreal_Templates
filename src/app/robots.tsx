import type { MetadataRoute } from 'next';
import { getSiteData } from '@/lib/api/siteData';
import { buildRobotsPolicy } from '@/lib/seo/robotsPolicy';
import { enforceDynamicUnlessIsr } from '@/lib/renderGate';

// ISR migration Phase 3. `revalidate` MUST be a literal — Next 16 parses route
// segment config out of this file's source and hard-fails the build on any
// expression, so the SITE_RENDER_MODE gate cannot live here. It lives in the
// render, in `enforceDynamicUnlessIsr()`. Keep 300 in step with
// ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`); `renderMode.test.ts` fails
// if they drift.
export const revalidate = 300;

/**
 * Site-wide robots policy.
 *
 * The composition (including the demo gate and the `Sitemap:` directive) lives
 * in `buildRobotsPolicy`, a plain JSX-free module so it can be invoked
 * directly by the test runner rather than hand-replicated in a test file. This
 * route is deliberately nothing but fetch + delegate.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`.
  await enforceDynamicUnlessIsr();
  const siteData = await getSiteData();
  return buildRobotsPolicy(siteData);
}
