import { LucideIcon } from 'lucide-react';
import { SiteData } from '@/types/SiteData';
import { TeamSyncData } from '../TeamSync';
import { FeatureGifSection } from '@/types/LandingPage/FeatureGifSection';
import { SolutionsSection } from '../SolutionsSection';
import { FeaturesSection } from '../FeaturesSection';
import { WhatWeDoData } from '../WhatWeDoSeciton';

export interface HeroSectionData {
  title?: string;
  subtitle?: string;
  button?: {
    size?: string;
    link?: string;
    text: string;
    color?: string;
    subtext?: string;
  };
  heroImage?: {
    name: string;
    key: string;
    type: string;
    source: string;
  };
  dataPoints?: PointCardProps[];
};

export interface HeroSectionProps {
  heroSectionData?: HeroSectionData;
  siteData?: SiteData;
  page: string;
};

export interface HeroValues {
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  button: {
    text: string;
  }
};

export interface PointCardProps {
  icon?: LucideIcon;
  iconString: string;
  title: string;
  description: string;
  delay?: number;
  color?: string;
};

