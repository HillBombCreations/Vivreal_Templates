import { SiteData } from "../SiteData";

export const LANDING_SECTION_API = "landingSections";
export const OUR_OFFERINGS_API = "ourOfferings";
export const PRODUCT_SHOWCASE_API = "productShowcase";

export type LandingSectionData = {
  objectValue: {
    title: string;
    subtitle: string;
    _id: string;
    buttonLabel?: string;
    image?: Image;
    sectionName?: string;
  }
};

export type Image = {
  name?: string;
  key?: string;
  type?: string;
};

export type LandingSection = {
  title: string;
  subtitle: string;
  _id: string;
  buttonLabel?: string;
  imageUrl?: string;
  sectionName?: string;
};

export type ProductShowcaseData = {
  objectValue: {
    _id: string;
    title: string;
    description: string;
    link?: string;
    productType?: string;
    image?: Image;
    buttonLabel?: string;
  }
};

export type ProductShowcase = {
  _id: string;
  title: string;
  description: string;
  link?: string;
  productType?: string;
  imageUrl?: string;
  buttonLabel?: string;
};

export type OurOfferingsData = {
  objectValue: {
    _id: string;
    title: string;
    description: string;
    icon?: string;
    image?: Image;
  }
};

export type OurOfferings = {
  _id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
};

export type ShowsSectionProps = {
  siteData?: SiteData;
};