import type { MetadataRoute } from 'next';
import { getSiteMap } from '@/lib/api/siteData';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteMap = await getSiteMap();

  if (Array.isArray(siteMap)) {
    return siteMap;
  }

  return [];
}