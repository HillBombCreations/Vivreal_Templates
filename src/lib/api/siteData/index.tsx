import { SiteData } from "@/types/SiteData";
import 'server-only';
import { cache } from "react";
import { siteData } from "@/data/mockData";

export const getSiteData = cache(async (): Promise<SiteData> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return siteData;
});