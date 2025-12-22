import { ElementType } from "react";
import { SiteData } from "../SiteData";

export type NavigationData = {
  path: string,
  label: string,
  displayOnHeader: boolean,
};

export type CardComponent = {
  title: string;
  subtitle: string;
  link: string;
  buttonText: string;
  image: React.FC<React.SVGProps<SVGSVGElement>>;
};

export interface NavigationMenuProps {
  items: NavigationData[];
  siteData: SiteData
};

export type NavItem = {
  loc?: string;
  path: string;
  linklabel?: string;
  group?: string;
  url?: NavItem[];
  iconstring?: string;
  icon?: ElementType;
  subtitle?: string;
  iconColor?: string;
  cardcomponent?: CardComponent
  label?: string;
};