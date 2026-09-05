import { ImageResponse } from 'next/og';
import { OG_CACHE_CONTROL, OG_SIZE, isLightColor } from './ogCard';

/**
 * The rendering half of the OG card, shared by `/og/[slug]` and
 * `/og/[slug]/[itemId]` so a per-item fallback card is byte-identical to the
 * page-level one. The decisions these functions act on live in `./ogCard.ts`,
 * which is pure and therefore testable.
 */

/**
 * Load the site display font (Outfit — the `--font-display` default) subset to
 * only the glyphs we render, so the card matches on-brand typography. Satori
 * cannot parse woff2, so we ask Google Fonts for the legacy truetype format
 * (returned when no modern-browser User-Agent is sent). Best-effort: on any
 * failure we return null and the card renders in ImageResponse's built-in
 * default font (the same fallback the repo's icon.tsx relies on).
 */
export async function loadDisplayFont(text: string): Promise<ArrayBuffer | null> {
  if (!text.trim()) return null;
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=Outfit:wght@700&text=${encodeURIComponent(
      text,
    )}`;
    const cssRes = await fetch(cssUrl, { cache: 'force-cache' });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const url = css.match(
      /src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:truetype|opentype)'\)/,
    )?.[1];
    if (!url) return null;
    const fontRes = await fetch(url, { cache: 'force-cache' });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Proxy a Studio-uploaded image. We fetch the freshly-signed media URL
 * SERVER-SIDE and return the bytes ourselves (never a redirect): the signed
 * media.vivreal.io URL expires, so a redirected/cached target would 403 once a
 * crawler revisits. Proxying means the crawler-facing URL (`/og/...`) is stable
 * and re-signs on every origin request. Returns null on any failure so the
 * caller falls through to the generated card.
 */
export async function proxyImageBytes(signedUrl: string): Promise<Response | null> {
  try {
    const res = await fetch(signedUrl, { cache: 'no-store' });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': OG_CACHE_CONTROL },
    });
  } catch {
    return null;
  }
}

/** Generate the branded card. */
export async function renderBrandedOgCard({
  heading,
  siteName,
  logoSrc,
  background,
}: {
  heading: string;
  siteName: string;
  logoSrc: string;
  background: string;
}): Promise<ImageResponse> {
  const light = isLightColor(background);
  const textColor = light ? '#111111' : '#ffffff';
  const subColor = light ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.78)';

  const hasLogo = logoSrc.startsWith('http');
  const showSiteName = !!siteName && siteName !== heading;

  const fontData = await loadDisplayFont(`${heading}${showSiteName ? siteName : ''}`);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background,
          padding: '72px 80px',
          fontFamily: fontData ? 'Outfit' : 'sans-serif',
        }}
      >
        {/* Top: logo when available, else the site name as a wordmark. */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {hasLogo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoSrc}
              alt=""
              height={84}
              style={{ height: 84, maxWidth: 460, objectFit: 'contain' }}
            />
          ) : (
            showSiteName && (
              <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: textColor }}>
                {siteName}
              </div>
            )
          )}
        </div>

        {/* Bottom: page title, with the site name below when a logo carried it. */}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '92%' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.15,
              color: textColor,
            }}
          >
            {heading}
          </div>
          {showSiteName && hasLogo && (
            <div style={{ display: 'flex', marginTop: 20, fontSize: 30, color: subColor }}>
              {siteName}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      ...(fontData
        ? { fonts: [{ name: 'Outfit', data: fontData, style: 'normal' as const, weight: 700 as const }] }
        : {}),
      headers: { 'Cache-Control': OG_CACHE_CONTROL },
    },
  );
}
