import type { MetadataRoute } from 'next';
import type {
  NavMenuItem,
  NavbarCta,
  NavbarHeaderStyle,
  FooterColumn,
  FooterLegal,
  FooterBrand,
  NavbarBrand,
  CartIcon,
  EmailPopupConfig,
  EmailCaptureConfig,
  SocialLink as RendererSocialLink,
  Block,
  FloatingCtaConfig,
  AnnouncementStripConfig,
  UtilityStripConfig,
  FulfillmentStripConfig,
  DetailPageConfig,
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
    /**
     * References the renderer's `DetailPageConfig` directly (two-axis
     * detail-route design — this mirror previously declared only `enabled`
     * + `integrations`, forcing every v0.4.0+ field read in this repo
     * through an `as DetailPageConfig` cast at the call site; extending the
     * type here doesn't remove those existing casts, but stops this
     * specific mirror from drifting further).
     */
    detailPage?: Omit<DetailPageConfig, 'integrations'> & {
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
        /**
         * Studio W6 — hide this page from search engines. Drives
         * `robots: { index: false, follow: false }` in the page's
         * `generateMetadata`.
         *
         * The NEGATIVE is stored on purpose: indexing is the default, so an
         * absent key must mean "indexed" — every page authored before this
         * field existed keeps its current behavior with no backfill.
         *
         * This only affects crawlers. The page stays publicly reachable by URL,
         * which is exactly what it is for (a thank-you or link-only page).
         */
        noindex?: boolean;
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
    /** Operator-owned public canonical origin, persisted with lifecycleState. */
    canonicalUrl?: string;
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
    /**
     * Studio W10.3 — the SITE-WIDE default share image. Same signed media shape
     * as `logo`/`heroImage`; stored under `siteDetails.values.defaultOgImage` and
     * signed by VR_Client_API through the `values.mediaFields` registry that
     * VR_Secure_API's site-level media lifecycle now writes for it.
     *
     * Consumed by `/og/[slug]` as the middle rung of the share-image fallback:
     * the page's own `labels.ogImage` wins, this covers every page that has
     * none, and the generated branded card is the floor. Absent ⇒ unchanged
     * behavior (page image, else generated card).
     */
    defaultOgImage?: {
        name?: string,
        key: string,
        type: string,
        currentFile?: {
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
        /**
         * `logoHeight` widened locally until the renderer bump publishes NavbarBrand.logoHeight.
         *
         * B1 media leg (renderer 1.54.0 R2) — `logoScrolled` is the backend-signed
         * sibling of the bare `logoScrolledKey`, exactly as `logo` is for `logoKey`.
         * `logoScrolledKey` is widened locally for the same reason `logoHeight` is:
         * the installed renderer publishes it only from 1.54.0 on.
         */
        brand?: (NavbarBrand & {
            logo?: BrandLogoMedia;
            logoHeight?: number;
            logoScrolledKey?: string;
            logoScrolled?: BrandLogoMedia;
        }) | null;
        /** Group B (N10) — cart glyph. Absent ⇒ default 'cart'. */
        cartIcon?: CartIcon | null;
        /** Header scroll treatment. null/absent ⇒ 'solid' (today's behavior). */
        headerStyle?: NavbarHeaderStyle | null;
        /** Secondary low-emphasis CTA left of the primary `cta` (e.g. "Log in"). */
        secondaryCta?: NavbarCta | null;
        /** Header container width. null/absent ⇒ 'contained' (today's max-w cap). */
        headerWidth?: 'contained' | 'full' | null;
        /**
         * H2 — MINIMUM desktop nav-row height in px, clamped [40,120] by the
         * renderer. null/absent ⇒ today's logo-derived bar height.
         */
        barHeight?: number | null;
        /** H2 — explicit MOBILE minimum; absent ⇒ min(barHeight, 72). */
        barHeightMobile?: number | null;
        /**
         * Gate-2 §7 — menu pattern. null/absent/'drawer' ⇒ today's MobileNav
         * drawer (byte-identical). 'overlay' ⇒ the renderer's full-screen
         * OverlayNav on ALL breakpoints (Pippin pattern). 'card' (Ansel kit,
         * bakery template #3) ⇒ the renderer's floating CardNav — the
         * hamburger is the sole trigger at every breakpoint.
         */
        menuStyle?: 'drawer' | 'overlay' | 'card' | null;
        /**
         * Gate-2 §7 — default OverlayNav background photo. Pre-signed contract
         * (a URL string or a descriptor with inlined currentFile.source — the
         * renderer's resolveMediaSrc reads either; it does no signing I/O).
         */
        overlayBackground?: { name?: string; key?: string; type?: string; currentFile?: { source?: string } } | string | null;
        /**
         * Bakery identity kit (Levain round) — header BAR arrangement.
         * 'logo-center' = nav tabs LEFT, brand absolutely CENTERED, actions
         * right. Absent/null ⇒ today's brand-left bar (byte-identical).
         * 'editorial' (Poilâne round) = the thin boutique bar: persistent
         * hairline rule, slim row, small uppercase letter-spaced tabs.
         * 'boutique' (Ansel kit, bakery template #3) = the utility header:
         * stacked brandKicker lockup + centered centerLabel + right-cluster
         * utilityNote lines. Pair with menuStyle:'card'.
         * 'band' (poster-pop kit, musician template #1) = the solid chrome
         * band: SOLID dark bar (bandColor), display-face uppercase arms with
         * a per-arm accent cycle (linkColorCycle), centered brand, and a
         * social-icon rail fed from top-level siteData.socialLinks.
         * 'garden' (House & Garden kit, wedding-venue look #2) = display-face
         * uppercase arms on generous letterspacing, centred.
         * 'stacked' (med-spa kit look #2) = the THREE-BAND header: the arms
         * lift onto a full-width JUSTIFIED row beneath the brand row.
         * 'mega' (saas-1 kit, vivreal.io relaunch) = the MEGA HEADER VEHICLE:
         * brand left, arms in flow beside it, dual action hard-right, each
         * children-bearing arm opening a full-width bar-docked mega panel
         * (multi-column grid + the tinted `megaFeature` promo rail), and a
         * net-new DRILL-DOWN condensed menu. Mirrors NavbarProps.layout.
         *
         * DRIFT NOTE: 'garden' and 'stacked' shipped in the renderer two and
         * one rounds ago respectively and were never mirrored here. Corrected
         * in the same edit that adds 'mega', on the item-5 precedent: widening
         * a mirror union is purely additive (no runtime output changes — TS
         * types are erased), and leaving a known stale enum on the line you
         * are already rewriting is worse than fixing it.
         */
        layout?: 'logo-center' | 'editorial' | 'boutique' | 'band' | 'garden' | 'stacked' | 'mega' | null;
        /**
         * Poster-pop kit — the 'band' bar's SOLID background color (renderer
         * validates via resolveColor). Mirrors NavbarProps.bandColor.
         */
        bandColor?: string | null;
        /**
         * Poster-pop kit — the 'band' per-arm nav accent cycle (arm i takes
         * linkColorCycle[i % length]). Mirrors NavbarProps.linkColorCycle.
         */
        linkColorCycle?: string[] | null;
        /**
         * Ansel kit — the small spaced-caps line ABOVE the siteName in the
         * 'boutique' stacked lockup. Mirrors NavbarProps.brandKicker.
         */
        brandKicker?: string | null;
        /**
         * Ansel kit — the wide-tracked caps label centered in the 'boutique'
         * bar (desktop; card/overlay menu only). Mirrors NavbarProps.centerLabel.
         */
        centerLabel?: string | null;
        /**
         * Ansel kit — up to two tiny info lines (address/hours) in the
         * 'boutique' right cluster. Mirrors NavbarProps.utilityNote.
         */
        utilityNote?: string[] | null;
        /**
         * Bakery identity kit (Levain round) — desktop dropdown treatment.
         * 'cards' = full-width image-card mega panel docked under the bar
         * (child image descriptors, pre-signed contract) with a trailing
         * "All <label> →" link. Absent/null ⇒ the compact/rich text panel.
         */
        dropdownStyle?: 'cards' | 'panel' | null;
        /**
         * REV-2 (heritage-editorial kit) — quiet uppercase TEXT action links
         * in the header's right cluster (the Poilane OUR ADDRESSES / SEARCH /
         * MY ACCOUNT language). Mirrors the renderer's NavbarProps.actions.
         */
        actions?: Array<{ label: string; href: string; external?: boolean; target?: '_self' | '_blank' }> | null;
        /**
         * Migration fidelity knob #8 — resting color of the desktop nav
         * link/trigger text. 'accent' ⇒ theme primary; any CSS color used
         * verbatim. Absent/null ⇒ current neutral. Mirrors the renderer's
         * NavbarProps.navLinkColor. (Missing from this local type was the
         * silent stable-build breaker: dev/Turbopack doesn't hard-fail type
         * errors, `next build` does — promote job 3 FAILED fleet-wide on it.)
         */
        navLinkColor?: string | null;
        /**
         * saas-1 kit — `layout:'mega'` panel DENSITY. Only 'compact' changes
         * anything; 'detailed'/null/absent are the roomy default (the default
         * IS the sentinel, so the Studio writes null rather than pinning a
         * literal). Ignored by every other layout. Mirrors
         * NavbarProps.megaDensity.
         */
        megaDensity?: 'compact' | 'detailed' | null;
        /**
         * saas-1 kit — `layout:'mega'`'s FEATURED REGION: a TINTED promo card
         * in every mega panel's right rail. Deliberately media-free (no
         * PageMediaDescriptor ⇒ no promote/sign surface). Absent/null/no
         * `heading` ⇒ nothing renders. Mirrors NavbarProps.megaFeature.
         */
        megaFeature?: {
            eyebrow?: string;
            heading?: string;
            body?: string;
            cta?: { label: string; href: string; external?: boolean; target?: '_self' | '_blank' };
        } | null;
        /**
         * Resale round — the net-new header SEARCH BAND. An arm in the bar
         * opens a full-width band docked over the header; the band submits a
         * native GET form to `action` carrying `queryParam` (e.g.
         * `/shop?search=…` — a REAL route the products storefront already
         * honours server-side). `suggestions` are AUTHORED links, not derived
         * typeahead. Absent/null/`enabled:false`/no `action` ⇒ no arm, no
         * band, byte-identical header. Mirrors the renderer's
         * NavbarProps.search / NavSearchConfig — and this local mirror is
         * LOAD-BEARING: a missing key here is a silent stable-build breaker
         * (dev/Turbopack tolerates it, `next build` does not).
         */
        search?: {
            enabled?: boolean;
            label?: string;
            placeholder?: string;
            action?: string;
            queryParam?: string;
            heading?: string;
            suggestionsLabel?: string;
            suggestions?: Array<{ label: string; href: string; external?: boolean; target?: '_self' | '_blank' }>;
            armSide?: 'left' | 'right';
            bandHeight?: number;
        } | null;
    } | null;
    /** Q3b — Studio-authored footer override (lazy; null/absent ⇒ auto-derive). */
    footer?: {
        columns?: FooterColumn[] | null;
        legal?: FooterLegal | null;
        hidePoweredBy?: boolean | null;
        /**
         * Group B — per-field inherit/override footer brand (logo + name + email
         * + description). Same presence-means-override semantics as the header
         * brand. `description` is widened locally until the renderer publishes
         * FooterBrand.description (Wave D) — drop the intersection member then.
         */
        brand?: (FooterBrand & { logo?: BrandLogoMedia; description?: string; logoFilter?: string }) | null;
        /** Group B — footer social-link overrides. Absent/null ⇒ falls back to siteData.socialLinks. */
        socialLinks?: RendererSocialLink[] | null;
        /** Owner pass 2 — 'icons' = glyph row in the brand column (vs the default Follow-Us text column). */
        socialStyle?: 'column' | 'icons' | null;
        /** Owner pass 2 — 'bar' = full-width "Stay in the loop" bar above the legal strip. */
        newsletterPlacement?: 'brand' | 'bar' | null;
        /**
         * Bakery identity kit (Levain round) — 'centerpiece' = centered brand +
         * newsletter + social icons between flanking link columns over
         * `background` (inverse text). Absent/null ⇒ today's 3-column grid.
         * 'wordmark' (Poilâne round) = the LIGHT grid + giant display
         * wordmark band (+ optional rotating `stamp` seal) + optional
         * `ticker` service marquee docked at the footer's top edge.
         * 'band' (poster-pop round B) = the SLIM single-strip legal band:
         * social icons left, legal cluster right, over `background`.
         */
        variant?: 'columns' | 'centerpiece' | 'wordmark' | 'band' | null;
        /** Centerpiece background — resolved CSS color; absent ⇒ var(--primary).
         *  Under 'wordmark' this is the LIGHT surface tint instead. */
        background?: string | null;
        /** Poilâne round — 'wordmark' only: the circular rotating stamp seal. */
        stamp?: { text?: string | null; label?: string | null } | null;
        /** Poilâne round — 'wordmark' only: the service-ticker marquee items. */
        ticker?: string[] | null;
    } | null;
    /**
     * Footer newsletter signup (parity #9) — TOP-LEVEL field, mirrors the
     * renderer's `SiteData.footerNewsletter` (not nested under `footer`).
     */
    footerNewsletter?: EmailCaptureConfig | null;
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
     * Site-level announcement/promo strip. Stored flat on the site doc (like
     * `chrome` / `emailPopup`); the Navbar server shell threads it into the
     * renderer's fixed header. Absent/null ⇒ no strip (back-compat).
     */
    announcement?: AnnouncementStripConfig | null;
    /**
     * Utility strip — slim persistent info bar in the fixed header (identity
     * kits §5.3). Stored flat like announcement; null/absent ⇒ no strip.
     */
    utilityStrip?: UtilityStripConfig | null;
    /**
     * Fulfillment strip — the Ansel-kit viewport-bottom channel pill (bakery
     * template #3). Stored flat like utilityStrip; the root layout mounts the
     * renderer's FulfillmentStrip from it. null/absent ⇒ no strip.
     */
    fulfillmentStrip?: FulfillmentStripConfig | null;
    /** Coastal Estate kit (wedding-venue look #3) — persistent bottom action
        bar. Mounted at page root in layout.tsx (the FulfillmentStrip
        precedent). Absent/null ⇒ no dock. */
    utilityDock?: {
      /** `false` hides an authored dock; absent ⇒ content decides. */
      enabled?: boolean;
      phone?: { label: string; href?: string } | null;
      address?: { label: string; href?: string } | null;
      action?: { label: string; href?: string } | null;
      note?: string | null;
      background?: string | null;
    } | null;
    /** Med-spa kit look #1 (Vesper) — the persistent VERTICAL page-EDGE action
        rail. Mounted at page root in layout.tsx on the UtilityDock contract;
        differs from it on AXIS (side edge vs bottom bar) and is desktop only.
        Absent/null ⇒ no rail. */
    edgeDock?: {
      /** `false` hides an authored rail; absent ⇒ content decides. */
      enabled?: boolean;
      label?: string | null;
      side?: 'left' | 'right' | null;
      actions?: { label: string; href?: string }[] | null;
      background?: string | null;
    } | null;
    /**
     * Brand-asset hardening — per-site favicon URL. Stored flat on the site doc
     * (same precedent as `chrome`/`floatingCta`; plain string, not a media
     * descriptor — the migrator persists it verbatim, no S3 upload/signing).
     * Absent ⇒ the root layout emits no `icons` metadata override, so Next's
     * existing default favicon behavior is unchanged (byte-identical no-op).
     */
    favicon?: string;
    /**
     * Per-site font theming — the migrated site's captured primary typeface
     * (e.g. `'Geist'`), normalized by the migrator from the crawled font stack
     * (`capture.brand.fonts[0]`; see Vivreal_Site_Migrator's `normalizeFontFamily`).
     * Stored flat on the site doc (same precedent as `favicon`/`chrome`) via
     * `theme.fontFamily` -> `siteDetailsVal.fontFamily`. A single family covers
     * BOTH `--font-display` and `--font-body` — migrated sites capture one
     * site-wide typeface, not a display/body pairing. Absent ⇒ the root layout
     * applies no font override, so the site renders with the existing hardcoded
     * Outfit default (byte-identical to pre-feature behavior). Distinct from the
     * separate Studio-authored `typography` (displayFamily/bodyFamily pairing,
     * read in Providers) — that client-side override still wins post-hydration
     * when present.
     */
    fontFamily?: string;
    /**
     * Per-site web-analytics config (migration continuity + portal-editable).
     * Stored flat inside `siteDetails.values` (same precedent as `favicon`/
     * `fontFamily`/`chrome`), so it round-trips through `getSiteData`'s
     * `...siteDetails.values` spread with no VR_Client_API change. The migrator
     * captures the SOURCE site's existing tag id so a migrated site keeps
     * reporting to the customer's own property; the portal Sites screen edits it.
     * Absent/null ⇒ the layout emits NO analytics tag (byte-identical no-op).
     * `trackingId` is the GA4 measurement id (`G-XXXX`), the Plausible
     * data-domain, or the Fathom site id, per `provider`.
     */
    analytics?: {
        provider?: 'google_analytics' | 'plausible' | 'fathom';
        trackingId?: string;
        /**
         * Consent Mode (vivreal.io relaunch, change item C3). True ⇒ the GA4
         * init string emits `gtag('consent','default',…)` denied BEFORE
         * `gtag('config',…)` and reads the `vr_internal` staff-traffic cookie.
         * Absent/false ⇒ byte-identical output for every existing site. Set on
         * the vivreal.io site doc only. Persisted through VR_Secure_API
         * updateSiteValues — a value written before that validator key deploys
         * is stripped SILENTLY, so read the doc back after every write.
         */
        consentMode?: boolean;
        /**
         * Named-vendor tag registry (change item C9) — extra marketing tags as
         * `{provider, id}` against a HARD-CODED snippet in
         * `src/lib/vendorTags.ts`. Never a URL and never a script body. An
         * unknown provider or a non-matching id renders nothing (fail-closed).
         * The only provider today is `clarity`; the tags are injected solely by
         * the apex-gated consent controller, so nothing here can reach a
         * customer site. Absent ⇒ no extra tag, i.e. every existing site.
         */
        additional?: Array<{ provider?: string; id?: string }>;
    } | null;
    /**
     * Migration lifecycle state (SEO demo-safety). `'demo'` = a pre-cutover
     * outreach/demo deployment that must NOT be indexed — it is a near-duplicate
     * of the prospect's real site, so indexing it would create live
     * duplicate-content exposure against them. `'live'` / absent = a normal,
     * indexable site. Stored flat inside `siteDetails.values` (same precedent as
     * `favicon`/`fontFamily`/`chrome`), so it round-trips through `getSiteData`'s
     * `...siteDetails.values` spread with no VR_Client_API change. Read by
     * `robots.tsx`, `sitemap.tsx`, and the root-layout metadata (see
     * `src/lib/seo/demoSafety.ts`). Cutover flips it to `'live'` (or clears it)
     * and revalidates — no rebuild. **Absent ⇒ indexable**, so every existing
     * site is byte-identically unaffected.
     */
    lifecycleState?: 'demo' | 'live';
    /**
     * The prospect's ORIGINAL live URL, carried from the migration source
     * (`inventory.meta.sourceUrl`). On a `demo` site the root-layout metadata
     * emits `<link rel="canonical">` → this URL so even a crawler that reaches
     * the demo attributes the content to the prospect's real site (SEO-signal
     * preservation, per the plan's §4A canonical-to-source rule). Absent ⇒ no
     * canonical override (the `noindex` alone still protects the prospect).
     */
    sourceUrl?: string;
    /**
     * Phase 0 of the two-axis detail-route design (§5.1/§7.2 step 10) — the
     * WS3 301 redirect map. One entry per MIGRATED page whose URL changed at
     * cutover (a flattened deep slug, a renamed page), so an old inbound
     * link / search-index entry 301s to the new URL instead of 404ing.
     * Stored flat inside `siteDetails.values` (same precedent as
     * `favicon`/`fontFamily`/`utilityStrip`), so it round-trips through
     * `getSiteData`'s `...siteDetails.values` spread with no VR_Client_API
     * change. Read by `[slug]/page.tsx`, `[slug]/[itemId]/page.tsx`,
     * `[...segments]/page.tsx`, and `src/middleware.ts` (edge) via
     * `resolveMissingItemRedirect()` — consulted ONLY after every real
     * page/detail-item lookup has failed, so a redirect can never shadow
     * live content.
     * Absent/empty (every non-migrated or unchanged-URL site) ⇒ byte-identical
     * no-op, zero extra work beyond one length check.
     */
    redirects?: { from: string; to: string; status?: number }[];
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
