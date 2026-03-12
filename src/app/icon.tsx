import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/siteData'

export const dynamic = 'force-dynamic'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default async function Icon() {
  const siteData = await getSiteData()

  const primaryColor = siteData?.primary || '#333333'
  const logoSrc = siteData?.logo?.currentFile?.source || ''
  const hasAbsoluteLogo = logoSrc.startsWith('http')

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
        {hasAbsoluteLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoSrc}
            alt="Site Logo"
            width="60%"
            height="60%"
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              width: '60%',
              height: '60%',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
            }}
          />
        )}
      </div>
    ),
    { ...size }
  )
}
