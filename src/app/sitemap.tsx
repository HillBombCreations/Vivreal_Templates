import type { MetadataRoute } from 'next';
// import { headers } from 'next/headers'

// const handleBuildUrl = async (type: string) => {
//   const h = await headers();
//   const host = h.get("x-forwarded-host") ?? h.get("host")!;
//   const proto = h.get("x-forwarded-proto") ?? "https";
//   const base = `${proto}://${host}`;
//   const url = new URL(`${base}/api/${type}`);
//   return url;
// };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // if (Array.isArray(siteMap)) {
  //   return siteMap;
  // }

  return [];
}