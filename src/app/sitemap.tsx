import type { MetadataRoute } from 'next';
import { getSiteData } from '@/lib/api/siteData';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteData = await getSiteData();

  if (Array.isArray(siteData?.siteMap)) {
    return siteData.siteMap;
  }

  return [];
}