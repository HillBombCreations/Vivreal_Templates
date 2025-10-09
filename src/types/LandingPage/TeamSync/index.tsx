import { SiteData } from "@/types/SiteData";
import type { LucideIcon } from "lucide-react";

export interface RolePointsData {
    title: string;
    description: string;
};

export interface RolesData {
    id: string;
    title: string;
    icon?: LucideIcon;
    iconString: string;
    color: string;
    image: string;
    points: RolePointsData[];
};

export interface TeamSyncData {
    title: string;
    subtitle: string;
    roles: RolesData[];
};

export interface TeamSyncDataProps {
    teamSyncData?: TeamSyncData;
    siteData?: SiteData;
};