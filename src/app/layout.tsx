import { ReactNode, ViewTransition } from 'react';
import '@/styles/globals.css';
import '@hillbombcreations/site-renderer/styles/content-grid.css';
import '@hillbombcreations/site-renderer/styles/animations.css';
import { getSiteData } from '@/lib/api/siteData';
import { isQuotaError } from '@/lib/api/client';
import Providers from '@/components/Providers';
import QuotaExceeded from '@/components/QuotaExceeded';
import { FloatingCta } from '@/components/RendererExports';

const RootLayout = async ({ children }: { children: ReactNode }) => {
  try {
    const siteData = await getSiteData();
    // `siteInfo.templateType` plumbed through VR_Client_API getSiteDetails +
    // getSiteData (2026-04-18). Restaurant sites render a Reserve-a-Table CTA.
    const templateType = siteData.siteInfo?.templateType;
    return (
      <html lang="en">
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