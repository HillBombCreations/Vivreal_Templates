import type { MetadataRoute } from 'next'
import { getSiteData } from '@/lib/api/SiteData'
import { SITE_DATA_API } from '@/types/SiteData'
import { headers } from 'next/headers'

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

export default async function robots(): Promise<MetadataRoute.Robots> {
    const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
    const siteData = await getSiteData(siteDataUrl.toString());

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/private/',
        },
        sitemap: `https://${siteData.domainName}/sitemap.xml`,
    }
}