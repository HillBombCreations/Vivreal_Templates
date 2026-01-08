import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/SiteData'
import { SITE_DATA_API } from '@/types/SiteData'
import { headers } from 'next/headers'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

const handleBuildUrl = async (type: string) => {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host")!;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const base = `${proto}://${host}`;
  const url = new URL(`${base}/api/${type}`);
  return url;
};

export default async function Icon() {
  const siteDataUrl = await handleBuildUrl(SITE_DATA_API);
  const siteData = await getSiteData(siteDataUrl.toString());

  const primaryColor = siteData?.siteDetails?.primary || '#001a4a'
  const logoSrc =
    siteData?.siteDetails?.logo?.imageUrl || 'https://vivreal.io/vrlogo.svg'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: primaryColor,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Site Logo"
          width="60%"
          height="60%"
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  )
}
