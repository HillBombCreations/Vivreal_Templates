import type { ContentItem } from "../types/ContentItem";
import type { SiteData } from "../types/SiteData";
interface Filter {
    title: string;
    key: string;
    filters?: string[];
}
interface ProductsPageProps {
    items: ContentItem[];
    filters?: Filter[];
    labels?: Record<string, unknown>;
    siteData?: SiteData;
    slug?: string;
    displayAs?: string;
}
export default function ProductsPage({ items, filters, labels, siteData, slug, displayAs }: ProductsPageProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ProductsPage.d.ts.map