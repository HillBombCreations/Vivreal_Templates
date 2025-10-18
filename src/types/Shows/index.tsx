import { SiteData } from "../SiteData";

export type ShowData = {
  title: string;
  description: string;
  date?: string;
  id: string;
  image?: string;
  imageUrl?: string;
};

export type CMSShowData = {
  objectValue: {
    Title: string;
    Description: string;
    Id: string;
    Body: string;
    createdAt?: string;
    Image?: {
      key: string;
      currentFile: { source: string };
    };
  }
};

export type ShowsSectionProps = {
  siteData?: SiteData;
};