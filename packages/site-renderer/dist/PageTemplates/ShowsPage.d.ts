import type { SiteData } from '../types/SiteData';
import type { ShowData } from '../types/Showcase';
export interface ShowsPageProps {
    upcomingShows: ShowData[];
    pastShows: ShowData[];
    labels: {
        title: string;
        subtitle: string;
        upcoming: string;
        past: string;
    };
    slug: string;
    siteData: SiteData;
    onLoadMore?: () => void;
    hasMore?: boolean;
    loadingMore?: boolean;
}
export default function ShowsPage({ upcomingShows, pastShows, labels, slug, siteData, onLoadMore, hasMore, loadingMore, }: ShowsPageProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ShowsPage.d.ts.map