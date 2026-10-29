import { ReactNode, ViewTransition, type CSSProperties } from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@hillbombcreations/site-renderer/styles/content-grid.css';
import '@hillbombcreations/site-renderer/styles/animations.css';
/*
 * The third renderer stylesheet, which this app was not importing. It backs the
 * two IMAGE_TREATMENTS entries that are real CSS rather than Tailwind utilities
 * (`image-duotone-primary`, `image-mask-vignette`); the renderer's own docblock
 * says a consumer must import it, and the Studio preview shell already did. That
 * asymmetry is what this line removes: from here the two surfaces load the same
 * three renderer stylesheets.
 *
 * A verified no-op for what live sites paint TODAY. At renderer 1.65.0 the only
 * component that can emit either class is `HomeSections/HeroSplit`, reached only
 * through `HomeSectionRenderer`, and `composition/blocks.ts`'s `mapHomeSection`
 * returns null for every home-section dispatchId except `hero` (which renders
 * `PageHero`, not HeroSplit). So no element on either surface carries either
 * class and neither rule can match. Adding the import now means the day a
 * component does emit one, the preview and the URL agree by default instead of
 * diverging silently.
 */
import '@hillbombcreations/site-renderer/styles/image-treatments.css';
import { getSiteData } from '@/lib/api/siteData';
import { resolveSiteOrigin } from '@/lib/og/ogImage';
import { buildRootMetadata } from '@/lib/seo/rootMetadata';
import { isQuotaError } from '@/lib/api/client';
import { resolveSiteFont } from '@/lib/fonts/siteFont';
import { siteFontStylesheets } from '@/lib/fonts/siteFontStylesheets';
import { themeVarStyle } from '@/lib/theme/themeVarStyle';
import { resolveMonoFamily } from '@hillbombcreations/site-renderer/theme';
import Providers from '@/components/Providers';
import QuotaExceeded from '@/components/QuotaExceeded';
import { FloatingCta, FulfillmentStrip, UtilityDock, EdgeDock } from '@/components/RendererExports';
import { JsonLd, buildSiteJsonLd } from '@/components/JsonLd';
import { nowInZone, readSiteHours, siteFontsHref, SITE_FONT_LITERAL_FAMILIES } from '@hillbombcreations/site-renderer';
import { contactButtonsSiteData } from '@/lib/contactButtons';
import SiteAnalytics from '@/components/SiteAnalytics';
import SiteBeacon from '@/components/SiteBeacon';
import AttributionCapture from '@/components/AttributionCapture';
import CtaClickTracking from '@/components/CtaClickTracking';
import SiteConsent from '@/components/SiteConsent';
import { resolveBannerPrivacyHref } from '@/components/SiteConsent/bannerPolicy';
import { isVivrealOwnSite } from '@/lib/vivrealApex';
import EmailPopup from '@/components/HomeSections/EmailPopup';
import { getSeedOnlyPaths } from '@/lib/seo/getSeedOnlyPaths';
import { resolvePrivacyPolicyHref } from '@/lib/pages/policyPage';
import { customerConsentTags } from '@/lib/adsTag';

/**
 * Root metadata. Sets `metadataBase` so any path-relative OG/canonical URLs
 * resolve to absolute and Next's "metadataBase is not set" warning is silenced.
 * The origin comes from the one shared chain in `src/lib/og/siteOrigin.ts`
 * (`canonicalUrl` → `NEXT_PUBLIC_SITE_URL` → `domainInformation.live_url` →
 * `domainName`), never from the request: CloudFront rewrites Host, so a
 * request-derived origin is unreliable. `surface: 'deployed'` because
 * `metadataBase` is per-request, not crawler-cached.
 *
 * Deliberately NO `title.template` here: Studio-authored `seo.metaTitle` must be
 * the EXACT title (the author owns the full string, un-suffixed). A parent
 * template would force `{ absolute }` gymnastics on every page and risk
 * double-wrapping `og:title`. Each page emits its own complete title instead.
 *
 * Guarded so metadata generation never throws the layout's quota path — a
 * 402 from getSiteData still renders <QuotaExceeded /> via the component below.
 *
 * Brand-asset hardening: `icons` is set from `siteData.favicon` ONLY when present
 * (migrated sites carrying a captured favicon/brand-mark). Absent `favicon` ⇒ no
 * `icons` key at all — Next's own default favicon resolution (e.g. an
 * app/favicon.ico convention file) is untouched, so every existing site renders
 * byte-identically to before this change.
 *
 * The metadataBase/favicon/demo-noindex/demo-canonical composition itself lives
 * in `buildRootMetadata` (src/lib/seo/rootMetadata.ts) — a plain, JSX-free
 * module so it can actually be unit-tested by calling the real function rather
 * than replicating its logic in a test file. See rootMetadata.test.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteData = await getSiteData();
    return buildRootMetadata(siteData);
  } catch {
    const envOrigin = resolveSiteOrigin(null, { surface: 'deployed' });
    return envOrigin ? { metadataBase: new URL(envOrigin) } : {};
  }
}

// The SSR theme variables: see src/lib/theme/themeVarStyle.ts.

import { Suspense } from "react";
import RouteProgress from "@/components/Navigation/RouteProgress";
import ContactButtonsChrome from "@/components/ContactButtonsChrome";

const RootLayout = async ({ children }: { children: ReactNode }) => {
  try {
    const siteData = await getSiteData();
    // THE fleet gate for Vivreal's own instrumentation, resolved once here and
    // passed down. It has to be resolved on the server: `SITE_ID` carries no
    // NEXT_PUBLIC_ prefix, so it does not exist in the client bundle. Reading
    // `process.env` costs this layout nothing and does not opt it out of static
    // rendering (see lib/vivrealApex.ts); <SiteBeacon> below reads the same
    // variable already. False on every customer site, and false whenever
    // SITE_ID is unset or unrecognised, which is the safe direction.
    const vivrealOwnSite = isVivrealOwnSite(process.env.SITE_ID);
    // Owner ideas T6 (D20): a customer site that connected a Google tag asks
    // its visitors first; null on every other customer site (no banner, head
    // tag unchanged) and always null on Vivreal's own site, which has its own.
    const customerTags = vivrealOwnSite ? null : customerConsentTags(siteData.analytics);
    // The popup's consent line and the cookie banner link only to a policy
    // page this site stores and the route would serve (see
    // lib/pages/policyPage.ts): there is no built-in /privacy any more, so a
    // default /privacy link would 404.
    // `getSeedOnlyPaths` is per-request `cache`d and the Navbar and Footer
    // already ask it, so this adds no read; it fails open to `[]`.
    const privacyHref = resolvePrivacyPolicyHref(siteData.pageConfigs, await getSeedOnlyPaths());
    // `siteInfo.templateType` plumbed through VR_Client_API getSiteDetails +
    // getSiteData (2026-04-18). Restaurant sites render a Reserve-a-Table CTA.
    const templateType = siteData.siteInfo?.templateType;
    // F-C15: the hours go through the renderer's own parser (the one every
    // hours surface draws from); `today` is the business's date, used only to
    // leave passed holiday changes out of the description.
    const contactSlice = contactButtonsSiteData(siteData);
    const siteSchema = buildSiteJsonLd(siteData, {
        hours: readSiteHours(siteData.businessInfo?.hours),
        today: nowInZone(siteData.timezone).dateISO,
    });
    // Per-site font theming — siteData.fontFamily is the migrator's captured
    // primary typeface (e.g. 'Geist' for vivreal.io). `null` when absent, in
    // which case NOTHING below renders (no className, no style, no <link>) —
    // the site keeps today's hardcoded Outfit default byte-identically. See
    // src/lib/fonts/siteFont.ts for the full loading-strategy rationale.
    // Storefront Phase 0.7: declared weights narrow the request; absent requests the default weights, so every site gets real bold (Contract 3).
    const siteFont = resolveSiteFont(siteData.fontFamily, siteData.fontWeights);
    // Gate-2 typography pairing — optional SECOND family for body copy
    // (siteData.fontFamilyBody, e.g. Varone's Marcellus display + Montserrat
    // body). Absent ⇒ null ⇒ --font-body keeps the display family exactly as
    // before (byte-identical for every existing site). Only meaningful when a
    // display font is also set (no body-only override).
    const siteFontBody = siteFont ? resolveSiteFont((siteData as { fontFamilyBody?: string | null }).fontFamilyBody, siteData.fontWeights) : null;
    // The same preset shape the Providers effect writes to --font-display/--font-body.
    const typography = (siteData as { typography?: { displayFamily?: unknown; bodyFamily?: unknown } | null }).typography;
    const fontStylesheets = siteFontStylesheets(
        {
            display: siteFont,
            body: siteFontBody,
            typographyPreset: [typography?.displayFamily, typography?.bodyFamily].some((f) => typeof f === 'string' && f.trim() !== ''),
            // Owner find 3: the face `--font-mono` names, by the builder's own rule.
            mono: resolveMonoFamily(siteData as unknown as Record<string, unknown>), // SiteData is a closed interface; the resolver reads it as a plain record
        },
        { sheetFor: siteFontsHref, families: SITE_FONT_LITERAL_FAMILIES },
    );
    // SSR the palette + density BEFORE hydration (see src/lib/theme/themeVarStyle.ts).
    // Providers' effect re-stamps both on the client; values are identical so
    // hydration stays clean.
    const themeStyle = themeVarStyle(siteData as unknown as Record<string, unknown>);
    const styleVariant = (siteData as { styleVariant?: string }).styleVariant;
    // Motion-signature preset (template-identity kits §6) — SSR-stamped like
    // styleVariant so first paint gets the preset's `--motion-*` tokens from
    // the renderer's content-grid.css; Providers re-stamps on the client.
    const motionPreset = (siteData as { motionPreset?: string }).motionPreset;
    return (
      <html
        lang="en"
        className={siteFont?.variableClassName}
        style={themeStyle}
        {...(styleVariant ? { 'data-style-variant': styleVariant } : {})}
        {...(motionPreset ? { 'data-motion-preset': motionPreset } : {})}
      >
          <head>
              {/* Structured data for classic crawlers + AI assistants. Emitted
                  here so every page inherits site-level Organization/WebSite. */}
              <JsonLd schema={siteSchema} />
              {/* Per-site web-analytics tag (migration continuity + portal-
                  editable). Reads siteData.analytics; absent ⇒ nothing renders
                  (byte-identical no-op for every existing site). NOT on
                  Vivreal's own site: there GA loads only after the visitor
                  accepts, from <SiteConsent> (lib/gaConsentLoad.ts). */}
              {/* Owner ideas T6: on a customer site that asks first about Google
                  Analytics, GA moves to <SiteConsent> too ("Reject, and none of
                  this runs"). Every other customer site renders exactly as before. */}
              {!vivrealOwnSite && !customerTags?.analytics && <SiteAnalytics analytics={siteData.analytics} />}
              {/* C1: the literal families (Inter, Outfit, ...) load from a
                  <link>, not from a globals.css @import, which the Turbopack
                  build drops, and only on a site that draws one. See
                  src/lib/fonts/siteFontStylesheets.ts. The preconnects open
                  the font origins only when a sheet is linked; the woff2
                  host is found only after the CSS parses otherwise. */}
              {fontStylesheets.length > 0 && (
                  <>
                      <link rel="preconnect" href="https://fonts.googleapis.com" />
                      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
                  </>
              )}
              {fontStylesheets.map((href) => (
                  <link key={href} rel="stylesheet" href={href} precedence="default" />
              ))}
          </head>
          <body
              style={
                  siteFont
                      ? ({ '--font-display': siteFont.cssValue, '--font-body': (siteFontBody ?? siteFont).cssValue } as CSSProperties)
                      : undefined
              }
          >
              <Providers siteData={siteData} vivrealOwnSite={vivrealOwnSite}>
                  {/*
                    Route-transition feedback. Any page this site's content
                    keeps dynamic waits on a server render with nothing on
                    screen changing — the site looks frozen and people click
                    again. Suspense because RouteProgress reads
                    useSearchParams, which opts the tree into client rendering
                    without one.
                  */}
                  <Suspense fallback={null}>
                      <RouteProgress />
                  </Suspense>
                  {/*
                    View Transitions: wraps route content so the browser
                    animates cross-fades between navigations automatically
                    (enabled via `experimental.viewTransition` in
                    next.config). Browsers without support (Safari <18)
                    render without transition — no explicit fallback needed.
                  */}
                  <ViewTransition>
                      {children}
                  </ViewTransition>
                  {/* Search R3: Call and Directions on phones, when the
                      business has a phone or an address and the owner has not
                      switched them off. Not with any other control fixed to the
                      bottom of a phone (UtilityDock, FulfillmentStrip,
                      FloatingCta): see contactButtonsSiteData. The bridge
                      hands the bar the current path (FP2-55). */}
                  {contactSlice && <ContactButtonsChrome siteData={contactSlice} />}
                  {templateType === 'restaurant' && (
                      <FloatingCta
                          label="Reserve a Table"
                          link="/reservations"
                          showAfterScroll={400}
                          hideOnPages={['/reservations']}
                      />
                  )}
                  {/* Ansel kit (bakery template #3) — the viewport-bottom
                      fulfillment/channel pill, config-driven from
                      siteData.fulfillmentStrip (the FloatingCta precedent).
                      The component itself gates on enabled/links; absent
                      config ⇒ nothing renders. */}
                  {siteData.fulfillmentStrip && (
                      <FulfillmentStrip config={siteData.fulfillmentStrip} />
                  )}
                  {/* Coastal Estate kit (wedding-venue look #3) — the persistent
                      BOTTOM action bar (phone · address · one squared CTA),
                      mounted at page ROOT like FulfillmentStrip. Never inside
                      the fixed header, which would cover it. The component
                      itself renders nothing when nothing is authored. */}
                  {siteData.utilityDock && (
                      <UtilityDock {...siteData.utilityDock} />
                  )}
                  {/* Med-spa kit look #1 (Vesper) — the persistent VERTICAL
                      page-EDGE action rail (rotated label + stacked actions),
                      mounted at page ROOT on the same contract as UtilityDock.
                      Differs from it on AXIS: side edge vs bottom bar. Desktop
                      only; the component renders nothing when nothing is
                      authored. */}
                  {siteData.edgeDock && (
                      <EdgeDock {...siteData.edgeDock} />
                  )}
                  {/* #3 — site-wide "get in touch" FAB, config-driven from
                      siteData.floatingCta (migrated marketing sites). Links to the
                      site's contact route; absent config ⇒ nothing renders. */}
                  {siteData.floatingCta?.label && siteData.floatingCta?.link && (
                      <FloatingCta
                          label={siteData.floatingCta.label}
                          link={siteData.floatingCta.link}
                          icon={siteData.floatingCta.icon}
                          showAfterScroll={siteData.floatingCta.showAfterScroll ?? 400}
                          position={siteData.floatingCta.position}
                          hideOnPages={siteData.floatingCta.hideOnPages ?? [siteData.floatingCta.link]}
                          /* Optional contact panel. These props are mapped
                             EXPLICITLY, so any new floatingCta key is dropped
                             unless it is threaded here too. */
                          fields={siteData.floatingCta.fields}
                          submitLabel={siteData.floatingCta.submitLabel}
                          /* Renderer 1.81.0: with an authored EdgeDock the
                             button hides at lg, where the rail shows, so the
                             two never compete for the same corner. Without
                             this prop the renderer cannot know a rail exists
                             and both render on desktop. */
                          edgeDockConfig={siteData.edgeDock}
                      />
                  )}
                  {/*
                    CC9 — Email-capture popup. Mounted at the layout (NOT the home
                    route) so per-page targeting is structurally possible. The
                    wrapper self-gates on route + config; absent emailPopup config
                    ⇒ legacy behavior (home-only, 3000ms, 24h cap, default copy,
                    on-iff-subscribers-collection) — byte-identical to the prior
                    home-only mount. See EmailPopup wrapper for the resolution.
                  */}
                  <EmailPopup
                      config={siteData.emailPopup ?? {}}
                      siteData={siteData}
                      vivrealOwnSite={vivrealOwnSite}
                      privacyHref={privacyHref}
                  />
                  {/* Vivreal first-party analytics beacon (cookieless). Fires only
                      on real deployed sites (SITE_ID set + != 'preview'); collection
                      is ON by default for every site (basic analytics is bundled). */}
                  <SiteBeacon siteId={process.env.SITE_ID ?? ''} vivrealOwnSite={vivrealOwnSite} />
                  {/* Vivreal campaign attribution (G12/C1) and Vivreal cookie
                      consent (G13/C2). BOTH are gated on the SITE ID, resolved
                      right here because `SITE_ID` is server only and a client
                      component cannot read it.

                      These two comments used to say the gate was the vivreal.io
                      apex and that both were inert on every customer site. That
                      was false, and this is the fix. The apex predicate matched
                      every subdomain of vivreal.io, which is how a customer site
                      with no purchased domain is served, so the banner rendered
                      and `vr_attr` was written on customer sites. See
                      lib/vivrealApex.ts for the whole story.

                      Reading `process.env` here does NOT opt the layout out of
                      static rendering; `headers()` would, and that is what the
                      old objection was about. <SiteBeacon> above already reads
                      the same variable.

                      Attribution exists in the fleet app at all because after
                      the CloudFront origin swap the Templates site IS
                      vivreal.io, and a first touch not captured on the landing
                      page is not recoverable later. Consent is mounted LAST so
                      the withdrawal affordance sits below the page footer
                      rather than floating over content. */}
                  <AttributionCapture vivrealOwnSite={vivrealOwnSite} />
                  {/* GA4 cta_click on Vivreal's own sites only, same gate. */}
                  <CtaClickTracking vivrealOwnSite={vivrealOwnSite} />
                  <SiteConsent
                      vivrealOwnSite={vivrealOwnSite}
                      customerTags={customerTags}
                      additional={siteData.analytics?.additional}
                      analytics={siteData.analytics}
                      privacyHref={resolveBannerPrivacyHref(privacyHref, vivrealOwnSite)}
                  />
              </Providers>
          </body>
      </html>
    );
  } catch (err) {
    // ─────────────────────────────────────────────────────────────────────
    // DEAD BRANCH, DELIBERATELY KEPT. Do not "fix" it into reachability.
    //
    // `<QuotaExceeded />` has not rendered once in production, and making it
    // render would be a REGRESSION, not a repair. Three separate reasons, all
    // verified 2026-08-31:
    //
    // 1. UNREACHABLE, render path. This catch guards the layout's OWN
    //    `getSiteData()` read only. Every content route calls `getSiteData()`
    //    again with no 402 guard at all (`page.tsx:22,:92`,
    //    `[slug]/page.tsx:75,:232,:704`, `[slug]/[itemId]/page.tsx:153,:759`,
    //    `[...segments]/page.tsx:57,:65`), so a 402 escapes from
    //    `generateMetadata` first and the route answers 500 before this is
    //    ever consulted.
    //
    // 2. UNREACHABLE, trigger. VR_Client_API has no general quota 402 left:
    //    W12 neutralized the API hard-402 and W4 the CDN one, both after a
    //    2026-07 incident where two free-tier groups served empty pages for
    //    days. The only surviving 402 is the spending-cap trip, which needs
    //    `overageBilling.enabled` AND `spendingCap.enabled`; a live census of
    //    `Vivreal.groups` finds zero groups enrolled.
    //
    // 3. Rendering it would VIOLATE the constraint it looks like it serves. A
    //    successful render on an SSG route is storable by construction: this
    //    page would become a cacheable 200 pinned at the CloudFront edge for
    //    up to an hour, and there is no invalidation API for an
    //    Amplify-managed distribution. The customer would pay and stay down.
    //    Today's compliance is accidental (it never renders); making it render
    //    turns that into a real violation.
    //
    // If you arrived here wanting to stop a FROZEN site from serving: that is
    // already done, and not here. A freeze is a 400 carrying
    // `code: 'GroupFrozen'` — never a 402, so `isQuotaError` has never matched
    // one — and it is handled ABOVE the render by `src/middleware.ts` +
    // `isSiteFrozen()`, which is the only position that can emit `no-store`.
    // Do NOT extend that gate to 402. Freeze must block; quota must never
    // block ("customer sites never go down" is a LOCKED product constraint,
    // see the W4/W12 comments in
    // `VR_Client_API/src/scripts/trackApiUsage.js`).
    //
    // Kept rather than deleted because the component and this branch are the
    // documented shape of the eventual quota UX, and deleting them would lose
    // the reasoning above at exactly the moment W5 makes someone look again.
    // ─────────────────────────────────────────────────────────────────────
    if (isQuotaError(err)) {
      return (
        <html lang="en">
          <body>
            <QuotaExceeded />
          </body>
        </html>
      );
    }
    throw err; // re-throw non-quota errors to global-error.tsx
  }
}

export default RootLayout;
