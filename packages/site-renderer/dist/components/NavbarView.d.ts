import type { ElementType } from 'react';
import type { NavItem } from '../types/SiteData';
export interface NavbarViewProps {
    siteName: string;
    logoUrl?: string;
    navItems: NavItem[];
    accentColor?: string;
    LinkComponent?: ElementType;
    ImageComponent?: ElementType;
}
export default function NavbarView({ siteName, logoUrl, navItems, accentColor, LinkComponent, ImageComponent, }: NavbarViewProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=NavbarView.d.ts.map