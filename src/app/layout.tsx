import { ReactNode } from 'react';
import '@/styles/globals.css';
import '@hillbombcreations/site-renderer/styles/content-grid.css';
import '@hillbombcreations/site-renderer/styles/animations.css';
import { getSiteData } from '@/lib/api/siteData';
import { isQuotaError } from '@/lib/api/client';
import Providers from '@/components/Providers';
import QuotaExceeded from '@/components/QuotaExceeded';

const RootLayout = async ({ children }: { children: ReactNode }) => {
  try {
    const siteData = await getSiteData();
    return (
      <html lang="en">
          <body>
              <Providers siteData={siteData}>
                  {children}
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