import { ReactNode } from 'react';
import '@/styles/globals.css';
import '@vivreal/site-renderer/styles/content-grid.css';
import '@vivreal/site-renderer/styles/animations.css';
import { getSiteData } from '@/lib/api/siteData';
import Providers from '@/components/Providers';

const RootLayout = async ({ children }: { children: ReactNode }) => {
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
}

export default RootLayout;