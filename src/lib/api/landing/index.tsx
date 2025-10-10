import { HeroSectionData } from "@/types/LandingPage/HeroSection";
import { SiteData } from "@/types/SiteData";
import { FeatureGifSection } from "@/types/LandingPage/FeatureGifSection";
import { SolutionsSection } from "@/types/LandingPage/SolutionsSection";
import { WhatWeDoData } from "@/types/LandingPage/WhatWeDoSeciton";
import { 
  siteData,
  heroSectionData,
  featureGifSectionData,
  solutionsSectionData,
  whatWeDoSectionData
} from "@/data/mockData";

export const getSiteData = async (): Promise<SiteData> => {
  return siteData;
};

export const getHeroSectionData = async (): Promise<HeroSectionData> => {
  return heroSectionData;
};


export const getFeatureGifSectionData = async (): Promise<FeatureGifSection> => {
  return featureGifSectionData;
};

export const getSolutionsSectionData = async (): Promise<SolutionsSection> => {
  return solutionsSectionData;
};

export const getWhatWeDoSectionData = async (): Promise<WhatWeDoData> => {
  return whatWeDoSectionData;
};