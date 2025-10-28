import 'server-only';
import { SiteData, CMSSiteData } from "@/types/SiteData";
import { cache } from "react";
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const SITE_ID = process.env.NEXT_PUBLIC_SITE_ID;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

export const getSiteData = async (): Promise<SiteData> => {
  const { data } = await axios.get<CMSSiteData>(`${API_URL}/tenant/baseSite`, {
      params: { siteId: SITE_ID },
      headers: {
          Authorization: API_KEY,
          "Content-Type": "application/json",
      },
  });
  return data.siteDetails.values;
};