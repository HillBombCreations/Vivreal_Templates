import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/siteData'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default async function AppleIcon() {
  const siteData = await getSiteData()

  const primaryColor = siteData?.primary || '#365B99'
  const logoSrc =
    siteData?.logo?.currentFile?.source || '/placeHolderLogo.png'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '30%',
          background: primaryColor,
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Apple Icon"
          width="60%"
          height="60%"
          style={{
            objectFit: 'contain',
          }}
        />
      </div>
    ),
    { ...size }
  )
}