import { LucideIcon } from 'lucide-react';
import { SiteData } from '@/types/SiteData';

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

