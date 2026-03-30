import type { NavItem, PageConfig } from '../types/SiteData';
export interface NavbarViewProps {
    siteName: string;
    logoUrl?: string;
    navItems: NavItem[];
    accentColor?: string;
    pageConfigs?: PageConfig[];
}
export default function NavbarView({ siteName, logoUrl, navItems, accentColor, pageConfigs, }: NavbarViewProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NavbarView.d.ts.map