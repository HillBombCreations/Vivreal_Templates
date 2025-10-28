import "server-only";
import type { MetadataRoute } from "next";
import type { CMSSiteData, SiteData } from "@/types/SiteData";

const API_URL = process.env.NEXT_PUBLIC_CLIENT_API!;
const SITE_ID = process.env.SITE_ID!;
const API_KEY = process.env.API_KEY!;


export const getSiteData = async (): Promise<SiteData> => {
  const res = await fetch(
    `${API_URL}/tenant/baseSite?siteId=${encodeURIComponent(SITE_ID)}`,
    {
      headers: {
        Authorization: API_KEY!,
        "Content-Type": "application/json"
      },
      // Choose ONE strategy:
      cache: "no-store",
      // next: { revalidate: 300 }, // e.g., ISR every 5 minutes
    }
  );

  if (!res.ok) {
    throw new Error(`getSiteData failed: ${res.status} ${res.statusText}`);
  }

  const data: CMSSiteData = await res.json();
  return data.siteDetails.values;
};

export const getSiteMap = async (): Promise<MetadataRoute.Sitemap> => {
  const res = await fetch(
    `${API_URL}/tenant/baseSite?siteId=${encodeURIComponent(SITE_ID)}`,
    {
      headers: { Authorization: API_KEY!, "Content-Type": "application/json" },
      // Choose ONE strategy:
      cache: "no-store",
      // next: { revalidate: 3600 }, // 1h ISR for sitemap
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch site data: ${res.status} ${res.statusText}`);
  }

  const data: CMSSiteData = await res.json();
  const domainName = data.domainName ?? "";
  if (!domainName) throw new Error("domainName missing from CMS response");

  const totalPages = data?.pages?.length || 1;

  const siteMap: MetadataRoute.Sitemap = [
    {
      url: `https://${domainName}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
  ];

  data?.pages.forEach((slug, idx) => {
    const page = String(slug).replace(/^\/+/, "");
    const priority = Math.max(0.1, 1.0 - (idx + 1) * (0.9 / totalPages));
    siteMap.push({
      url: `https://${domainName}/${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: Number(priority.toFixed(2)),
    });
  });

  return siteMap;
};