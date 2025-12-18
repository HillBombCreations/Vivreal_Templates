import { ReactNode } from 'react';
import '@/styles/globals.css';
import { getSiteData } from '@/lib/api/siteData';
import { SITE_DATA_API } from '@/types/SiteData'
import Providers from '@/components/Providers';
import Navbar from '@/components/Navigation/Navbar';
import { headers } from 'next/headers'
import Footer from '@/components/Footer';

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const siteData = await getSiteData(siteDataUrl.toString());
  return (
    <html lang="en">
        <body>
            <Providers siteData={siteData}>
                <Navbar siteData={siteData}/>
                {children}
                <Footer siteData={siteData} />
            </Providers>
        </body>
    </html>
  );
}

export default RootLayout;