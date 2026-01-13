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

export const SITE_DATA_API = "siteData";

export type SiteDetails = {
    primary?: string;
    secondary?: string;
    hover?: string;
    surface?: string;
    ["surface-alt"]?: string;
    ["text-primary"]?: string;
    ["text-secondary"]?: string;
    ["text-inverse"]?: string;
    logo: {
        name?: string,
        key?: string,
        type?: string,
        imageUrl?: string,
    }
}

export interface SocialLinks {
    type: string;
    link: string;
}

export interface SiteData {
    businessInfo?: Businessinfo;
    name?: string;
    domainInformation: {
        domain?: string;
        subdomain?: string;
        live_url?: string;
    }
    socialLinks: SocialLinks[];
    siteDetails: SiteDetails
    pages?: Record<string, string>;
}



export type Pages = {
    name: string;
    format: string;
}

export type CMSSiteData = {
    _id: string;
    name: string;
    domainInformation: {
        domain?: string;
        subdomain?: string;
        live_url?: string;
    }
    groupID: string;
    socialLinks: SocialLinks[];
    pages: [Pages];
    siteDetails: {
        schema: object;
        values: SiteDetails;
    }
    businessInfo: Businessinfo;
};