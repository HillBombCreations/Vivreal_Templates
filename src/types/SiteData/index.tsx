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
  Block,
  FloatingCtaConfig,
} from '@hillbombcreations/site-renderer';

/**
 * Per-block media descriptor — mirrors the renderer's `PageMediaDescriptor`
 * (`vivreal-site-renderer/src/types/SiteData.ts:236-240`).
 * Re-declared here because the renderer package does not re-export it from index.ts.
 * Keep in sync if the renderer shape changes.
 */
interface PageMediaDescriptor {
  name?: string;
  key?: string;
  type?: string;
}

/**
 * Hero background configuration — mirrors the renderer's `HeroBackground`
 * (`vivreal-site-renderer/src/types/SiteData.ts:251-264`).
 * Re-declared here because the renderer package does not re-export it from index.ts.
 * Keep in sync if the renderer shape changes.
 */
interface HeroBackground {
  type: 'gradient' | 'image' | 'video';
  image?: PageMediaDescriptor;
  video?: PageMediaDescriptor;
  poster?: PageMediaDescriptor;
  overlay?: number;
}

/**
 * Universal page hero struct — mirrors the renderer's `PageHero`
 * (`vivreal-site-renderer/src/types/SiteData.ts:275-287`).
 * Re-declared here because the renderer package does not re-export it from index.ts.
 * Keep in sync if the renderer shape changes.
 *
 * `heroImage` is the optional SIDE/feature image (NOT the background).
 */
export interface PageHero {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  heroImage?: PageMediaDescriptor;
  buttonLabel?: string;
  buttonLink?: string;
  partnerTagline?: string;
  trustIndicators?: { icon: string; text: string }[];
  background?: HeroBackground;
}

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
    /**
     * Dedicated universal hero struct (Group A §1 — blocks-unification ph.0).
     * Mirror of the renderer's `PageHero` (`vivreal-site-renderer/src/types/SiteData.ts:302`).
     * Absent on legacy pages not yet backfilled; the renderer falls back to `page.labels`
     * for copy derivation. Ph.1 prefetch reads this via block bindings, not this field.
     */
    hero?: PageHero;
    /**
     * Authored building-block composition (blocks-unification ph.1 KEYSTONE).
     * When present + non-empty, `collectBindingTargets` enumerates bindings from
     * these blocks instead of the legacy `collections`/`integrations` arrays.
     * `Block` is imported from `@hillbombcreations/site-renderer`
     * (`vivreal-site-renderer/src/types/Block.ts`).
     * Absent ⇒ legacy `getPageBindingsByRole` path runs unchanged (back-compat fallback).
     */
    blocks?: Block[];
    displayOnHeader?: boolean;
    displayOnFooter?: boolean;
    cta?: PageCtaConfig;
    detailPage?: {
        enabled?: boolean;
        integrations?: PageIntegrationBinding[];
    };
    /**
     * Studio-authored SEO text overrides (optional). `PageSchema` is
     * `strict:false`, so this round-trips through VR_Client_API untouched — no
     * migration needed. Absent ⇒ the label/name-derived metadata defaults apply
     * (no regression).
     *   - `metaTitle`: exact `<title>` / `og:title` (NOT suffixed with the site
     *     name — the author owns the full string).
     *   - `metaDescription`: exact meta description / `og:description`.
     *
     * The per-page OG *image* is authored separately as a media descriptor under
     * `labels.ogImage` (VR_Client_API signs it into `.currentFile.source`, same
     * as `logo`/`heroImage`); the `/og/[slug]` route proxies it, falling back to
     * a generated branded card when absent.
     */
    seo?: {
        metaTitle?: string;
        metaDescription?: string;
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
    /**
     * Deployed URL info from the Client API. `live_url` is the site's actual
     * live origin (subdomain like https://<sub>.vivreal.io, or the custom
     * domain once live) — set on every deployed site, unlike `domainName`
     * (custom domain only, absent on subdomain sites). Used as the canonical
     * origin fallback for metadata when NEXT_PUBLIC_SITE_URL isn't set.
     */
    domainInformation?: { live_url?: string };
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
    /**
     * Chrome dark/light mode. When `'dark'`, the three chrome zones — Navbar,
     * Hero/banner, and Footer — render with `var(--surface-alt)` background and
     * `var(--text-inverse)` text. Body content blocks stay on `surface`.
     *
     * Lives at the flat top level of `siteData` (getSiteData spreads
     * `...raw.siteDetails.values`, so DB-stored fields land here, not under
     * a `theme` sub-object). Read as `siteData.chrome`, same as `siteData.primary`.
     *
     * Absent / `'light'` ⇒ existing light behavior (no regression).
     */
    chrome?: 'dark' | 'light';
    /** Group subscription tier — gates the footer "Powered by Vivreal" toggle. */
    tier?: string;
    /**
     * Site-wide "get in touch" floating action button (parity #3). Stored flat on
     * the site doc (like `chrome` / `emailPopup`); the root layout mounts
     * {@link FloatingCta} from it. Absent ⇒ no FAB (back-compat).
     * Mirror of the renderer's `FloatingCtaConfig` (re-imported here, same
     * precedent as the other renderer-shaped fields above).
     */
    floatingCta?: FloatingCtaConfig;
    /**
     * Brand-asset hardening — per-site favicon URL. Stored flat on the site doc
     * (same precedent as `chrome`/`floatingCta`; plain string, not a media
     * descriptor — the migrator persists it verbatim, no S3 upload/signing).
     * Absent ⇒ the root layout emits no `icons` metadata override, so Next's
     * existing default favicon behavior is unchanged (byte-identical no-op).
     */
    favicon?: string;
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
