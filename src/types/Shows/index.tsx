import { SiteData } from "../SiteData";

export type ShowData = {
  title: string;
  description: string;
  id: string;
  /** The record's own last change, ISO (discovery batch 3.3, the sitemap date). */
  updatedAt?: string;
  date?: string;
  time?: string;
  image?: string;
  imageUrl?: string;
  /** Responsive srcset of the poster's resized variants (empty when no derivatives). */
  imageSrcSet?: string;
  location?: string;
  /** The show's own street address, when its content type has the field (discovery batch 3.1). */
  address?: string;
  ticketsUrl?: string;
};

export type CMSShowData = {
  _id: string;
  updatedAt?: string;
  objectValue: {
    title: string;
    description: string;
    date?: string;
    time?: string;
    poster?: {
      key: string;
      currentFile: { source: string };
    };
    location?: string;
    address?: string;
    venueAddress?: string;
    tickets_url?: string;
  }
};

export type ShowsSectionProps = {
  siteData?: SiteData;
};