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
    shipping?: boolean
}

export interface SiteData {
    primary?: string;
    domainName?: string;
    businessInfo?: Businessinfo;
    secondary?: string;
    hover?: string;
    surface?: string;
    pages: Record<string, string>;
    siteMap: MetadataRoute.Sitemap;
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    border?: string;
    logo: {
        name?: string,
        key: string,
        type: string,
        currentFile: {
            source: string
        }
    },
}

export type SiteDetails = {
    primary?: string;
    domainName?: string;
    businessInfo?: Businessinfo;
    secondary?: string;
    hover?: string;
    surface?: string;
    pages: Record<string, string>;
    siteMap: MetadataRoute.Sitemap;
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    border?: string;
    logo: {
        name?: string,
        key: string,
        type: string,
        currentFile: {
            source: string
        }
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
};