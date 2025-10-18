import { SiteData } from '../SiteData';
import { ArticlesSectionData } from '@/types/Shows';
import { HeroSectionData } from './HeroSection';
import { TeamSyncData } from './TeamSync';
import { FeatureGifSection } from './FeatureGifSection';
import { SolutionsSection } from './SolutionsSection';
import { FeaturesSection } from './FeaturesSection';
import { WhatWeDoData } from './WhatWeDoSeciton';
export interface LandingPageProps {
  siteData?: SiteData;
  articleSectionData?: ArticlesSectionData;
  heroSectionData?: HeroSectionData;
  teamSyncData?: TeamSyncData;
  featureGifSectionData?: FeatureGifSection;
  solutionsSectionData?: SolutionsSection;
  featuresSectionData?: FeaturesSection;
  whatWeDoSectionData?: WhatWeDoData;
};