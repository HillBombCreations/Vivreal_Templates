import { SiteData } from "@/types/SiteData";
import type { LucideIcon } from "lucide-react";

export interface SolutionsData {
    id: string;
    title: string;
    description: string;
    icon?: LucideIcon;
    iconString: string;
};

export interface SolutionsSection {
    title: string;
    linkText: string;
    solutions: SolutionsData[];
};

export interface SolutionsSectionProps {
    solutionsSection?: SolutionsSection;
    siteData?: SiteData;
};