import { SiteData } from "../SiteData";

export type ShowData = {
  title: string;
  description: string;
  id: string;
  date?: string;
  time?: string;
  image?: string;
  imageUrl?: string;
  location?: string;
  ticketsUrl?: string;
};

export type CMSShowData = {
  objectValue: {
    title: string;
    _id: string;
    description: string;
    date?: string;
    time?: string;
    poster?: {
      key: string;
      currentFile: { source: string };
    };
    location?: string;
    tickets_url?: string;
  }
};

export type ShowsSectionProps = {
  siteData?: SiteData;
};