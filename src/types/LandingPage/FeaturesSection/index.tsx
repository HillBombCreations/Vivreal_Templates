import { SiteData } from "@/types/SiteData";
import type { LucideIcon } from "lucide-react";

export interface FeaturesData {
    title: string;
    description: string;
    icon?: LucideIcon;
    iconString: string;
    color: string;
};

export interface FeatureCardProps {
    title: string;
    iconString: string;
    description: string;
    siteData?: SiteData;
};

export interface FeaturesSection {
    title: string;
    subtitle: string;
    features: FeaturesData[];
};

export interface FeaturesSectionProps {
    featuresSection?: FeaturesSection;
    siteData?: SiteData;
};