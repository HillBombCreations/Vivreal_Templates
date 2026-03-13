import type { MetadataRoute } from 'next';

export interface Businessinfo {
    address?: {
        street1?: string,
        street2?: string,
        city?: string,
        state?: string,
        zip?: string
    },
    contactInfo: {
        email?: string,
        phoneNumber?: string
    },
    name?: string,
    description?: string,
    shipping?: boolean
}

export interface SocialLink {
    platform: string;
    url: string;
}

export interface PageConfig {
    name: string;
    slug: string;
    format: 'collection-list' | 'collection-detail' | 'form' | 'static' | string;
    collectionId: string | null;
    labels: Record<string, string>;
    displayOnHeader?: boolean;
    displayOnFooter?: boolean;
}

export interface SiteData {
    primary?: string;
    domainName?: string;
    name?: string;
    businessInfo?: Businessinfo;
    socialLinks?: SocialLink[];
    secondary?: string;
    hover?: string;
    surface?: string;
    pages: Record<string, string>;
    pageConfigs: PageConfig[];
    siteMap: MetadataRoute.Sitemap;
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    border?: string;
    partnerTagline?: string;
    logo: {
        name?: string,
        key: string,
        type: string,
        currentFile: {
            source: string
        }
    },
    heroImage?: {
        name?: string,
        key: string,
        type: string,
        currentFile: {
            source: string
        }
    },
    aboutSection?: {
        heading?: string,
        description?: string,
    },
}

export type Pages = {
    name: string;
    format: string;
}

export type CMSSiteData = {
    _id: string;
    name: string;
    domainName: string;
    groupID: string;
    pages: [Pages];
    siteDetails: {
        schema: object;
        values: SiteData;
    }
    businessInfo: Businessinfo;
    socialLinks?: SocialLink[];
}
