import { ImageResponse } from 'next/og'
import { getSiteData } from '@/lib/api/siteData'
import { enforceDynamicUnlessIsr } from '@/lib/renderGate'
import { isLightColor, planIconMark } from '@/lib/og/ogCard'
import { loadDisplayFont } from '@/lib/og/ogCardRender'

// ISR migration Phase 3. `revalidate` MUST be a literal — Next 16 parses route
// segment config out of this file's source and hard-fails the build on any
// expression, so the SITE_RENDER_MODE gate cannot live here. It lives in the
// render, in `enforceDynamicUnlessIsr()`. Keep 300 in step with
// ISR_REVALIDATE_SECONDS (`src/lib/renderMode.ts`); `renderMode.test.ts` fails
// if they drift.
export const revalidate = 300

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default async function Icon() {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`.
  await enforceDynamicUnlessIsr()
  const siteData = await getSiteData()

  const primaryColor = siteData?.primary || '#333333'
  const logoSrc = siteData?.logo?.currentFile?.source || ''
  // Never hand the logo URL to <img>: a text wordmark SVG would be drawn with
  // host fonts the server lacks (boxes). Same decision as the share card.
  const mark = await planIconMark(logoSrc, siteData?.businessInfo?.name || siteData?.name)
  const fontData = mark.kind === 'initial' ? await loadDisplayFont(mark.initial) : null

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
        {mark.kind === 'image' ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mark.src}
            alt="Site Logo"
            width="60%"
            height="60%"
            style={{ objectFit: 'contain' }}
          />
        ) : mark.kind === 'initial' ? (
          <div
            style={{
              display: 'flex',
              fontSize: 20,
              fontWeight: 700,
              lineHeight: 1,
              color: isLightColor(primaryColor) ? '#111111' : '#ffffff',
              fontFamily: fontData ? 'Outfit' : 'sans-serif',
            }}
          >
            {mark.initial}
          </div>
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
    {
      ...size,
      ...(fontData
        ? { fonts: [{ name: 'Outfit', data: fontData, style: 'normal' as const, weight: 700 as const }] }
        : {}),
    }
  )
}
