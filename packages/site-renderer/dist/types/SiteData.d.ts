export interface BusinessInfo {
    address?: {
        street1?: string;
        street2?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
    contactInfo: {
        email?: string;
        phoneNumber?: string;
    };
    name?: string;
    description?: string;
    shipping?: boolean;
}
export interface SocialLink {
    type: string;
    link: string;
}
export interface NavItem {
    name: string;
    slug: string;
    path: string;
    group?: string;
}
export interface PageIntegrationBinding {
    type?: string;
    name?: string;
    role?: 'primary' | 'secondary' | 'supplemental' | 'sidebar';
    displayAs?: string;
    /** Collection ID for integration-type collections (e.g., product filters). */
    collectionId?: string;
}
export interface PageCollectionBinding {
    collectionId: string;
    name?: string;
    role?: 'primary' | 'secondary' | 'supplemental' | 'sidebar';
    displayAs?: 'cards' | 'table' | 'carousel' | 'timeline' | 'gallery' | 'section' | 'banner' | 'showcase' | 'feature-list' | 'form' | 'stats' | 'reviews' | 'grid' | 'feed';
    sectionType?: string;
    sectionConfig?: Record<string, unknown>;
    order?: number;
    enabled?: boolean;
    subtitle?: string;
}
export interface PageCtaConfig {
    enabled?: boolean;
    heading?: string;
    subheading?: string;
    label?: string;
    linkTo?: string;
}
export interface PageConfig {
    name: string;
    slug: string;
    format: 'collection-list' | 'collection-detail' | 'form' | 'static' | string;
    collectionId: string | null;
    collections?: PageCollectionBinding[];
    integrations?: PageIntegrationBinding[];
    labels: Record<string, unknown>;
    displayOnHeader?: boolean;
    displayOnFooter?: boolean;
    cta?: PageCtaConfig;
    detailPage?: {
        enabled?: boolean;
        integrations?: PageIntegrationBinding[];
    };
}
export interface HomeSectionConfig {
    collectionId?: string;
    sectionName?: string;
    [key: string]: unknown;
}
export interface HomeSection {
    type: string;
    order: number;
    enabled: boolean;
    config: HomeSectionConfig;
}
export interface SiteData {
    primary?: string;
    domainName?: string;
    name?: string;
    businessInfo?: BusinessInfo;
    socialLinks?: SocialLink[];
    secondary?: string;
    hover?: string;
    surface?: string;
    pages: Record<string, string>;
    pageConfigs: PageConfig[];
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    border?: string;
    partnerTagline?: string;
    logo: {
        name?: string;
        key: string;
        type: string;
        currentFile: {
            source: string;
        };
    };
    heroImage?: {
        name?: string;
        key: string;
        type: string;
        currentFile: {
            source: string;
        };
    };
    aboutSection?: {
        heading?: string;
        description?: string;
    };
    homeSections?: HomeSection[];
    homePageConfig?: PageConfig | null;
}
//# sourceMappingURL=SiteData.d.ts.map