import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const handleBuildUrl = async () => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
};

export default async function robots(): Promise<MetadataRoute.Robots> {
    const base = await handleBuildUrl();

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ["/private", "/api"],
        },
        sitemap: `${base}/sitemap.xml`,
    }
}