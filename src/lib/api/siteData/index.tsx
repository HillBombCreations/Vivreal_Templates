import { SiteData } from "@/types/SiteData";
import 'server-only';
import { cache } from "react";
import { siteData } from "@/data/mockData";

export const getSiteData = cache(async (): Promise<SiteData> => {
  return siteData;
});