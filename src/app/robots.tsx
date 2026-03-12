import type { MetadataRoute } from 'next'
import { getSiteData } from '@/lib/api/siteData';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
    const siteData = await getSiteData();

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/private/',
        },
        sitemap: `https://${siteData.domainName}/sitemap.xml`,
    }
}