import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/siteData'
import { enforceDynamicUnlessIsr } from '@/lib/renderGate'

// ISR migration Phase 3. `revalidate` MUST be a literal — Next 16 parses route
// segment config out of this file's source and hard-fails the build on any
// expression, so the SITE_RENDER_MODE gate cannot live here. It lives in the
// render, in `enforceDynamicUnlessIsr()`. Keep 300 in step with
// ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`); `renderMode.test.ts` fails
// if they drift.
export const revalidate = 300

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default async function AppleIcon() {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`.
  await enforceDynamicUnlessIsr()
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
          borderRadius: '30%',
          background: primaryColor,
          overflow: 'hidden',
        }}
      >
        {hasAbsoluteLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={logoSrc}
            alt="Apple Icon"
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
