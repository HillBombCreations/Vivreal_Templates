import { SiteData } from "@/types/SiteData";
import type { LucideIcon } from "lucide-react";

export interface FeaturesData {
    title: string;
    icon?: LucideIcon;
    iconString: string;
    description: string;
};

export interface WhatWeDoData {
    title: string;
    features: FeaturesData[];
};

export interface WhatWeDoSectionProps {
    whatWeDoData?: WhatWeDoData;
    siteData?: SiteData;
};