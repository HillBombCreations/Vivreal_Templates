import { SiteData } from "../SiteData";

export type ArticleData = {
  title: string;
  description: string;
  type?: string;
  date?: string;
  slug: string;
  body: string;
  image?: string;
  imageUrl?: string;
};

export type CMSArticleData = {
  objectValue: {
    Title: string;
    Description: string;
    createdAt?: string;
    "Url Slug": string;
    Body: string;
    Image?: {
      key: string;
      currentFile: { source: string };
    };
  }
};


export type ArticlesSectionData = {
  title?: string;
  linkText?: string;
  linkSlug?: string;
  mobileLabel?: string;
  loadingMessage?: string;
  noDataMessage?: string;
  carouselData?: ArticleData[];
};

export type ArticlesSectionProps = {
  articleSectionData?: ArticlesSectionData;
  siteData?: SiteData;
};