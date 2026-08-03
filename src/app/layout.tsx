import { ReactNode, ViewTransition, type CSSProperties } from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@hillbombcreations/site-renderer/styles/content-grid.css';
import '@hillbombcreations/site-renderer/styles/animations.css';
import { getSiteData } from '@/lib/api/siteData';
import { isDemoSite, getDemoSourceUrl } from '@/lib/seo/demoSafety';
import { resolveSiteOrigin } from '@/lib/og/ogImage';
import { isQuotaError } from '@/lib/api/client';
import { resolveSiteFont } from '@/lib/fonts/siteFont';
import { readableAccentOnWhite } from '@/lib/theme/readableAccent';
import Providers from '@/components/Providers';
import QuotaExceeded from '@/components/QuotaExceeded';
import { FloatingCta, FulfillmentStrip, UtilityDock, EdgeDock } from '@/components/RendererExports';
import { JsonLd, buildSiteJsonLd } from '@/components/JsonLd';
import SiteAnalytics from '@/components/SiteAnalytics';
import SiteBeacon from '@/components/SiteBeacon';
import EmailPopup from '@/components/HomeSections/EmailPopup';

/**
 * Root metadata. Sets `metadataBase` so any path-relative OG/canonical URLs
 * resolve to absolute and Next's "metadataBase is not set" warning is silenced.
 * Origin prefers `NEXT_PUBLIC_SITE_URL` (canonical per-site; CloudFront rewrites
 * Host, so request-derived origins are unreliable), falling back to the API
 * domain.
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
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteData = await getSiteData();
    const origin = resolveSiteOrigin(siteData);
    // SEO demo-safety: a pre-cutover demo emits `noindex, nofollow` on every
    // page, and points its canonical at the prospect's ORIGINAL site so any
    // crawler that still reaches the demo attributes the content there (signal
    // preservation, §4A). Absent a known source URL, the noindex alone protects
    // them. Fail-safe: a non-demo (every existing site) adds neither key and is
    // byte-identical to before.
    const demo = isDemoSite(siteData);
    const demoSource = demo ? getDemoSourceUrl(siteData) : '';
    return {
      ...(origin && { metadataBase: new URL(origin) }),
      ...(siteData.favicon && { icons: { icon: siteData.favicon } }),
      ...(demo && { robots: { index: false, follow: false } }),
      ...(demo && demoSource && { alternates: { canonical: demoSource } }),
    };
  } catch {
    const envOrigin = resolveSiteOrigin(null);
    return envOrigin ? { metadataBase: new URL(envOrigin) } : {};
  }
}

/**
 * Theme tokens SSR'd onto `<html>` so the FIRST paint — including route-level
 * `loading.tsx` skeletons — is palette-correct. Without this, the tokens only
 * arrive via the client-side Providers effect, so a dark-theme site (e.g.
 * surface #0a0a0a) flashed a WHITE skeleton on every hard navigation.
 * Whitelisted to the siteDetails theme schema's color tokens — NOT every
 * string key on siteData (favicon is a multi-KB data URI; name/domain are not
 * CSS values). The Providers effect remains the post-hydration authority and
 * sets the same custom properties, so the two never disagree.
 */
const THEME_TOKEN_KEYS = [
  'primary',
  'secondary',
  'hover',
  'surface',
  'surface-alt',
  'text-primary',
  'text-secondary',
  'text-inverse',
] as const;

function themeVarStyle(siteData: Record<string, unknown>): CSSProperties | undefined {
  const style: Record<string, string> = {};
  for (const key of THEME_TOKEN_KEYS) {
    const v = siteData[key];
    if (typeof v === 'string' && v.trim() !== '') style[`--${key}`] = v;
  }
  // Derived token — the AA-on-white variant of the brand accent, consumed by
  // the renderer's rich-text link rule (`.vr-rich a`) and any accent-as-text
  // surface. Only emitted for parseable hex primaries; the CSS falls back to
  // `--primary` otherwise (byte-identical for non-hex/absent primaries).
  const readable = readableAccentOnWhite(style['--primary']);
  if (readable) style['--accent-readable'] = readable;

  // `text-secondary` is commonly left unauthored (optional in the theme schema).
  // Leaving it unset here means every consuming component falls through to ITS
  // OWN hardcoded fallback (`var(--text-secondary, #555)`, `#64748b`, `#6b7280`,
  // ...) — all fixed mid-grays that go illegible on a dark/saturated brand
  // surface (the "navy blue text on dark red" defect, 2026-07). Setting an
  // actual `--text-secondary` here wins the CSS cascade over every component's
  // per-call fallback, so derive one muted TOWARD the site's own surface instead
  // of leaving the gap for a dozen different generic grays to fill in.
  if (!style['--text-secondary']) {
    const textPrimary = style['--text-primary'] ?? '#1c1c1c';
    const surface = style['--surface'] ?? '#ffffff';
    style['--text-secondary'] = `color-mix(in oklab, ${textPrimary} 55%, ${surface})`;
  }

  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}

const RootLayout = async ({ children }: { children: ReactNode }) => {
  try {
    const siteData = await getSiteData();
    // `siteInfo.templateType` plumbed through VR_Client_API getSiteDetails +
    // getSiteData (2026-04-18). Restaurant sites render a Reserve-a-Table CTA.
    const templateType = siteData.siteInfo?.templateType;
    const siteSchema = buildSiteJsonLd(siteData);
    // Per-site font theming — siteData.fontFamily is the migrator's captured
    // primary typeface (e.g. 'Geist' for vivreal.io). `null` when absent, in
    // which case NOTHING below renders (no className, no style, no <link>) —
    // the site keeps today's hardcoded Outfit default byte-identically. See
    // src/lib/fonts/siteFont.ts for the full loading-strategy rationale.
    const siteFont = resolveSiteFont(siteData.fontFamily);
    // Gate-2 typography pairing — optional SECOND family for body copy
    // (siteData.fontFamilyBody, e.g. Varone's Marcellus display + Montserrat
    // body). Absent ⇒ null ⇒ --font-body keeps the display family exactly as
    // before (byte-identical for every existing site). Only meaningful when a
    // display font is also set (no body-only override).
    const siteFontBody = siteFont ? resolveSiteFont((siteData as { fontFamilyBody?: string | null }).fontFamilyBody) : null;
    // SSR the palette + density BEFORE hydration (see themeVarStyle above).
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
                  (byte-identical no-op for every existing site). */}
              <SiteAnalytics analytics={siteData.analytics} />
              {siteFont?.googleFontsHref && (
                  <link rel="stylesheet" href={siteFont.googleFontsHref} precedence="default" />
              )}
              {siteFontBody?.googleFontsHref && (
                  <link rel="stylesheet" href={siteFontBody.googleFontsHref} precedence="default" />
              )}
          </head>
          <body
              style={
                  siteFont
                      ? ({ '--font-display': siteFont.cssValue, '--font-body': (siteFontBody ?? siteFont).cssValue } as CSSProperties)
                      : undefined
              }
          >
              <Providers siteData={siteData}>
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
                  <EmailPopup config={siteData.emailPopup ?? {}} siteData={siteData} />
                  {/* Vivreal first-party analytics beacon (cookieless). Fires only
                      on real deployed sites (SITE_ID set + != 'preview'); collection
                      is ON by default for every site (basic analytics is bundled). */}
                  <SiteBeacon siteId={process.env.SITE_ID ?? ''} />
              </Providers>
          </body>
      </html>
    );
  } catch (err) {
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