import { SiteData } from "@/types/SiteData";
import type { LucideIcon } from "lucide-react";

export interface FeaturesData {
    id: string;
    title: string;
    icon?: LucideIcon;
    iconString: string;
    color: string;
    description: string;
    gif: string;
    path: string;
};

export interface FeatureGifSection {
    title: string;
    subtitle: string;
    features: FeaturesData[];
};

export interface FeatureGifSectionProps {
    featureGifSection?: FeatureGifSection;
    siteData?: SiteData;
};