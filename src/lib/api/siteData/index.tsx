import type { CMSSiteData, SiteData } from "@/types/SiteData";
import { headers } from "next/headers";

const SITE_DATA_API = "siteData";

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

export const getSiteData = async (): Promise<SiteData> => {
  const url = await handleBuildUrl(SITE_DATA_API);
  
  const res = await fetch(url.toString(), {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`getSiteData failed: ${res.status} ${res.statusText}`);
  }

  const data: CMSSiteData = await res.json();
  return data.siteDetails.values;
};