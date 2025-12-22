import type { SiteData } from "@/types/SiteData";

export const getSiteData = async (url: string): Promise<SiteData> => {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`getSiteData failed: ${res.status} ${res.statusText}`);
  }

  return await res.json();
};