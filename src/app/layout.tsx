import { ReactNode, ViewTransition } from 'react';
import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@hillbombcreations/site-renderer/styles/content-grid.css';
import '@hillbombcreations/site-renderer/styles/animations.css';
import { getSiteData } from '@/lib/api/siteData';
import { resolveSiteOrigin } from '@/lib/og/ogImage';
import { isQuotaError } from '@/lib/api/client';
import Providers from '@/components/Providers';
import QuotaExceeded from '@/components/QuotaExceeded';
import { FloatingCta } from '@/components/RendererExports';
import { JsonLd, buildSiteJsonLd } from '@/components/JsonLd';
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
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const siteData = await getSiteData();
    const origin = resolveSiteOrigin(siteData);
    return origin ? { metadataBase: new URL(origin) } : {};
  } catch {
    const envOrigin = resolveSiteOrigin(null);
    return envOrigin ? { metadataBase: new URL(envOrigin) } : {};
  }
}

const RootLayout = async ({ children }: { children: ReactNode }) => {
  try {
    const siteData = await getSiteData();
    // `siteInfo.templateType` plumbed through VR_Client_API getSiteDetails +
    // getSiteData (2026-04-18). Restaurant sites render a Reserve-a-Table CTA.
    const templateType = siteData.siteInfo?.templateType;
    const siteSchema = buildSiteJsonLd(siteData);
    return (
      <html lang="en">
          <head>
              {/* Structured data for classic crawlers + AI assistants. Emitted
                  here so every page inherits site-level Organization/WebSite. */}
              <JsonLd schema={siteSchema} />
          </head>
          <body>
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
                  {/*
                    CC9 — Email-capture popup. Mounted at the layout (NOT the home
                    route) so per-page targeting is structurally possible. The
                    wrapper self-gates on route + config; absent emailPopup config
                    ⇒ legacy behavior (home-only, 3000ms, 24h cap, default copy,
                    on-iff-subscribers-collection) — byte-identical to the prior
                    home-only mount. See EmailPopup wrapper for the resolution.
                  */}
                  <EmailPopup config={siteData.emailPopup ?? {}} siteData={siteData} />
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