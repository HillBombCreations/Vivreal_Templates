import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/siteData'

// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

// Dynamic icon generation
export default async function Icon() {
  const siteData = await getSiteData()

  const primaryColor = siteData?.primary || '#001a4a'
  const logoSrc =
    siteData?.logo?.currentFile?.source || 'https://comedycollectivechi.com/comedycollectiveLogo.png'

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
