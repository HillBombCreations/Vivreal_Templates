import { ElementType } from "react";

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