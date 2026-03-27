import type { ElementType } from 'react';
import type { NavItem, SocialLink } from '../types/SiteData';
export interface FooterViewProps {
    siteName: string;
    logoUrl?: string;
    email?: string;
    navItems: NavItem[];
    socialLinks?: SocialLink[];
    accentColor?: string;
    LinkComponent?: ElementType;
    ImageComponent?: ElementType;
}
export default function FooterView({ siteName, logoUrl, email, navItems, socialLinks, accentColor, LinkComponent, ImageComponent, }: FooterViewProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=FooterView.d.ts.map