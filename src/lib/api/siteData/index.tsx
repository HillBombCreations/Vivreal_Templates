import "server-only";
import type { MetadataRoute } from "next";
import type { CMSSiteData, SiteData } from "@/types/SiteData";

const API_URL = process.env.CLIENT_API!;
const SITE_ID = process.env.SITE_ID!;
const CMS_API_KEY = process.env.API_KEY!;

// Fallback data when API is unavailable
const FALLBACK_SITE_DATA: SiteData = {
  primary: "#000000",
  secondary: "#333333",
  hover: "#555555",
  surface: "#ffffff",
  "surface-alt": "#f5f5f5",
  "text-primary": "#000000",
  "text-secondary": "#666666",
  "text-inverse": "#ffffff",
  border: "#e0e0e0",
  pages: {},
  siteMap: [],
  logo: {
    name: "",
    key: "",
    type: "",
    currentFile: { source: "" },
  },
};

export const getSiteData = async (): Promise<SiteData> => {
  try {
    const res = await fetch(
      `${API_URL}/tenant/baseSite?siteId=${encodeURIComponent(SITE_ID)}`,
      {
        headers: {
          Authorization: CMS_API_KEY!,
          "Content-Type": "application/json"
        },
        // Choose ONE strategy:
        cache: "no-store",
        // next: { revalidate: 300 }, // e.g., ISR every 5 minutes
      }
    );

    if (!res.ok) {
      return FALLBACK_SITE_DATA;
    }

    const data: CMSSiteData = await res.json();
    return data.siteDetails.values;
  } catch {
    return FALLBACK_SITE_DATA;
  }
};

export const getSiteMap = async (): Promise<MetadataRoute.Sitemap> => {
  try {
    const res = await fetch(
      `${API_URL}/tenant/baseSite?siteId=${encodeURIComponent(SITE_ID)}`,
      {
        headers: { Authorization: CMS_API_KEY!, "Content-Type": "application/json" },
        // Choose ONE strategy:
        cache: "no-store",
        // next: { revalidate: 3600 }, // 1h ISR for sitemap
      }
    );

    if (!res.ok) {
      return [];
    }

    const data: CMSSiteData = await res.json();
    const domainName = data.domainName ?? "";
    if (!domainName) {
      return [];
    }

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
  } catch {
    return [];
  }
};