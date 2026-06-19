import type { MetadataRoute } from 'next';
import type {
  NavMenuItem,
  NavbarCta,
  FooterColumn,
  FooterLegal,
  FooterBrand,
  NavbarBrand,
  CartIcon,
  EmailPopupConfig,
  SocialLink as RendererSocialLink,
} from '@hillbombcreations/site-renderer';

/**
 * Group B — a brand-override logo as delivered to the Templates wrapper. The
 * renderer cannot sign URLs, so the WRAPPER signs. Brand override stores a bare
 * `logoKey`; the backend (VR_Client_API getSiteDetails) signs it and delivers a
 * sibling media object here (mirroring how `siteData.logo` arrives pre-signed
 * with `currentFile.source`). Until the backend lands that, `logo` is absent and
 * the wrapper falls back to inheriting the businessInfo logo.
 */
export interface BrandLogoMedia {
    key?: string;
    type?: string;
    currentFile?: { source: string };
}

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
    type: string;
    link: string;
}

export interface PageIntegrationBinding {
    type?: string;
    name?: string;
    role?: 'primary' | 'secondary' | 'supplemental' | 'sidebar';
    displayAs?: 'feed' | 'grid' | 'carousel' | 'cards' | 'table' | 'timeline' | 'gallery' | 'banner' | 'showcase' | 'feature-list' | 'form' | 'stats' | 'reviews';
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

export interface PageCtaConfig extends Record<string, unknown> {
    enabled?: boolean;
    heading?: string;
    subheading?: string;
    label?: string;
    linkTo?: string;
    [key: string]: unknown;
}

export interface PageConfig {
    name: string;
    slug: string;
    format: 'collection-list' | 'collection-detail' | 'form' | 'static' | string;
    collectionId: string | null;
    collections?: PageCollectionBinding[];
    integrations?: PageIntegrationBinding[];
    labels: Record<string, string>;
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
    homeSections?: HomeSection[];
    homePageConfig?: PageConfig | null;
    /**
     * Template-level metadata. `templateType` is used by the root layout to gate
     * template-specific UI (e.g., the restaurant Reserve-a-Table FloatingCta).
     * Plumbed through VR_Client_API → getSiteData → here.
     */
    siteInfo?: {
        templateType?: 'ecommerce' | 'showcase' | 'restaurant' | 'services' | 'portfolio' | string;
        mode?: string;
        typography?: {
            presetId?: string;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    /** Q3b — Studio-authored navbar override (lazy; null/absent ⇒ auto-derive). */
    navigation?: {
        menuItems?: NavMenuItem[] | null;
        cta?: NavbarCta | null;
        /**
         * Group B — per-field inherit/override header brand. ABSENT key ⇒ inherit
         * businessInfo; PRESENT (incl. "") ⇒ override. `logo` is the backend-signed
         * media object for `brand.logoKey` (the wrapper signs via getSignedUrl).
         */
        brand?: (NavbarBrand & { logo?: BrandLogoMedia }) | null;
        /** Group B (N10) — cart glyph. Absent ⇒ default 'cart'. */
        cartIcon?: CartIcon | null;
    } | null;
    /** Q3b — Studio-authored footer override (lazy; null/absent ⇒ auto-derive). */
    footer?: {
        columns?: FooterColumn[] | null;
        legal?: FooterLegal | null;
        hidePoweredBy?: boolean | null;
        /**
         * Group B — per-field inherit/override footer brand (logo + name + email).
         * Same presence-means-override semantics as the header brand.
         */
        brand?: (FooterBrand & { logo?: BrandLogoMedia }) | null;
        /** Group B — footer social-link overrides. Absent/null ⇒ falls back to siteData.socialLinks. */
        socialLinks?: RendererSocialLink[] | null;
    } | null;
    /**
     * CC9 — Studio-authored email-capture popup config. Lazy: null/absent ⇒ the
     * EmailPopup wrapper falls back to legacy behavior (implicit-on iff a
     * subscribers collection exists, hardcoded copy, 3000ms, 24h, home-only).
     * Plumbed through VR_Client_API getSiteDetails → getSiteData → here.
     */
    emailPopup?: EmailPopupConfig | null;
    /** Group subscription tier — gates the footer "Powered by Vivreal" toggle. */
    tier?: string;
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
