import { ImageResponse } from 'next/og';
import { getSiteData } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { getSignedUrl } from '@/lib/api/media';

// Never cached at the route level — the underlying media URL is re-signed per
// request so the crawler-facing og:image (/og/<slug>) never expires. Downstream
// CDN caching is handled via the response Cache-Control header below.
export const dynamic = 'force-dynamic';

const OG_SIZE = { width: 1200, height: 630 } as const;

// Shared with the [slug] route: privacy/terms render on every site without a
// portal page config, so give them a sensible card heading.
const STATIC_TITLES: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

// Cache the generated card / proxied image at the CDN so repeated crawler hits
// don't regenerate or re-proxy on every request.
const OG_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400';

/**
 * Perceived-lightness check so card text stays legible on any brand color.
 * Standard luma weights; > 0.6 ⇒ treat as light (use dark text). Non-hex or
 * malformed input ⇒ treated as dark (white text), the safer default.
 */
function isLightColor(hex: string): boolean {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length < 6) return false;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return false;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

/**
 * Load the site display font (Outfit — the `--font-display` default) subset to
 * only the glyphs we render, so the card matches on-brand typography. Satori
 * cannot parse woff2, so we ask Google Fonts for the legacy truetype format
 * (returned when no modern-browser User-Agent is sent). Best-effort: on any
 * failure we return null and the card renders in ImageResponse's built-in
 * default font (the same fallback the repo's icon.tsx relies on).
 */
async function loadDisplayFont(text: string): Promise<ArrayBuffer | null> {
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
 * Proxy the page's Studio-uploaded OG image. We fetch the freshly-signed
 * media URL SERVER-SIDE and return the bytes ourselves (never a redirect): the
 * signed media.vivreal.io URL has a ~300s TTL, so a redirected/cached target
 * would 403 once a crawler revisits. Proxying means the crawler-facing URL
 * (/og/<slug>) is stable and re-signs on every origin request. Returns null on
 * any failure so the caller falls through to the generated card.
 */
async function proxyUploadedImage(signedUrl: string): Promise<Response | null> {
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const siteData = await getSiteData();
  const siteName = siteData.businessInfo?.name || siteData.name || '';

  const pageConfig =
    slug === 'home' ? siteData.homePageConfig ?? undefined : getPageBySlug(siteData, slug);

  // 1. Prefer the page's Studio-uploaded OG image. It lives under
  //    `labels.ogImage` as a media descriptor (VR_Client_API signs it into
  //    `.currentFile.source`, same as logo/hero). `labels` is typed
  //    `Record<string, string>`, so read the descriptor through `unknown` —
  //    getSignedUrl accepts unknown and returns '' for non-media values.
  const ogImageField = (pageConfig?.labels as Record<string, unknown> | undefined)?.ogImage;
  const signedUpload = getSignedUrl(ogImageField);
  if (signedUpload.startsWith('http')) {
    const proxied = await proxyUploadedImage(signedUpload);
    if (proxied) return proxied;
    // else: upstream unreachable — fall through to the generated card.
  }

  // 2. Generate a branded card.
  const heading = (
    pageConfig?.seo?.metaTitle ||
    pageConfig?.labels?.title ||
    pageConfig?.name ||
    (slug === 'home' ? siteName : STATIC_TITLES[slug]) ||
    siteName ||
    slug
  ).slice(0, 100);

  const background = siteData.primary || '#0f172a';
  const light = isLightColor(background);
  const textColor = light ? '#111111' : '#ffffff';
  const subColor = light ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.78)';

  const logoSrc = getSignedUrl(siteData.logo);
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
