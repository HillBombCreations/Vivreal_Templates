import type { SiteData } from '../types/SiteData';
import type { TeamMemberData } from '../types/Showcase';
export interface TeamPageProps {
    members: TeamMemberData[];
    labels: {
        title: string;
        subtitle: string;
    };
    slug: string;
    siteData: SiteData;
}
export default function TeamPage({ members, labels, slug, siteData, }: TeamPageProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=TeamPage.d.ts.map