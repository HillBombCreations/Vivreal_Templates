import type { MetadataRoute } from 'next';
import { getSiteData } from '@/lib/api/siteData';
import { buildRobotsPolicy } from '@/lib/seo/robotsPolicy';

export const dynamic = 'force-dynamic';

/**
 * Site-wide robots policy.
 *
 * The composition (including the demo gate and the `Sitemap:` directive) lives
 * in `buildRobotsPolicy`, a plain JSX-free module so it can be invoked
 * directly by the test runner rather than hand-replicated in a test file. This
 * route is deliberately nothing but fetch + delegate.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteData = await getSiteData();
  return buildRobotsPolicy(siteData);
}
