import { HeroSectionData } from "@/types/LandingPage/HeroSection";
import { SiteData } from "@/types/SiteData";
import { TeamSyncData } from "@/types/LandingPage/TeamSync";
import { FeatureGifSection } from "@/types/LandingPage/FeatureGifSection";
import { SolutionsSection } from "@/types/LandingPage/SolutionsSection";
import { ArticlesSectionData } from "@/types/Articles";
import { FeaturesSection } from "@/types/LandingPage/FeaturesSection";
import { WhatWeDoData } from "@/types/LandingPage/WhatWeDoSeciton";
import { 
  siteData,
  heroSectionData,
  teamSyncData,
  featureGifSectionData,
  solutionsSectionData,
  articlesSectionData,
  featuresSectionData,
  whatWeDoSectionData
} from "@/data/mockCmsData";

export const getSiteData = async (): Promise<SiteData> => {
  return siteData;
};

export const getHeroSectionData = async (): Promise<HeroSectionData> => {
  return heroSectionData;
};

export const getTeamSyncData = async (): Promise<TeamSyncData> => {
  return teamSyncData;
};

export const getFeatureGifSectionData = async (): Promise<FeatureGifSection> => {
  return featureGifSectionData;
};

export const getSolutionsSectionData = async (): Promise<SolutionsSection> => {
  return solutionsSectionData;
};

export const getArticlesSectionData = async (): Promise<ArticlesSectionData> => {
  return articlesSectionData;
};

export const getFeaturesSectionData = async (): Promise<FeaturesSection> => {
  return featuresSectionData;
};

export const getWhatWeDoSectionData = async (): Promise<WhatWeDoData> => {
  return whatWeDoSectionData;
};