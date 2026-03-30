import type { ShowData, PartnerData } from '../types/Showcase';
import type { SiteData } from '../types/SiteData';
export interface HeroSectionShowcaseProps {
    siteData: SiteData;
    shows?: ShowData[];
    partners?: PartnerData[];
    labels?: {
        upcoming?: string;
        past?: string;
    };
    showsSlug?: string;
    config?: Record<string, unknown>;
    prefetchedData?: Record<string, unknown>;
}
declare const HeroSectionShowcase: (props: HeroSectionShowcaseProps) => import("react/jsx-runtime").JSX.Element;
export default HeroSectionShowcase;
//# sourceMappingURL=HeroSectionShowcase.d.ts.map