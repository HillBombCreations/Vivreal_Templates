import { SiteData } from "../SiteData";
import { Lightbulb, Target, Handshake } from "lucide-react";
import { JSX } from 'react';

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
  "product-type"?: string;
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

export type ContactSectionContent = {
  title: string;
  subtitle: string;
  buttonLabel: string;
};

export type ContactSectionProps = {
  contactSection: ContactSectionContent | null;
};

export type ToastState =
  | { open: false }
  | { open: true; type: "success" | "error"; message: string };


export type FeatureIcon = "lightBulb" | "target" | "heart";
  
export type OurOfferingsProps = {
  ourOfferings: OurOfferings[];
};
  
export const IconMap: Record<FeatureIcon, JSX.Element> = {
  lightBulb: <Lightbulb className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  heart: <Handshake className="h-4 w-4" />,
};

type ProductShowcaseSection = {
  title: string;
  subtitle: string;
};

export type ProductShowcaseProps = {
  productShowcase: ProductShowcase[];
  productShowcaseSection: ProductShowcaseSection | null;
};

export type HeroSectionProps = {
  heroSection: LandingSection | null;
}

export type LandingSections = {
  heroSection: LandingSection;
  productShowcase: LandingSection;
  contactUs: ContactSectionContent;
  aboutUs: LandingSection;
  sectionName: string;
};

export type LandingWrapperProps = {
  landingSections: LandingSections | null;
  productShowcase: ProductShowcase[];
  ourOfferings: OurOfferings[];
};