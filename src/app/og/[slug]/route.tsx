import { getSiteData } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { getSignedUrl } from '@/lib/api/media';
import { resolvePageOgHeading } from '@/lib/og/ogCard';
import { proxyImageBytes, renderBrandedOgCard } from '@/lib/og/ogCardRender';
import { isDemoSite } from '@/lib/seo/demoSafety';
import { withDemoRobotsHeader } from '@/lib/seo/demoRobotsHeader';

// Never cached at the route level — the underlying media URL is re-signed per
// request so the crawler-facing og:image (/og/<slug>) never expires. Downstream
// CDN caching is handled via the response Cache-Control header below.
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const siteData = await getSiteData();
  // Discovery batch 3.4, route layer: a demo's share card is noindex even when
  // middleware's edge map was cold. See demoRobotsHeader.ts.
  const isDemo = isDemoSite(siteData);
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
    const proxied = await proxyImageBytes(signedUpload);
    if (proxied) return withDemoRobotsHeader(proxied, isDemo);
    // else: upstream unreachable — fall through to the generated card.
  }

  // 1.5. Fall back to the SITE-WIDE default share image (Studio W10.3). Covers
  //    every page the author did not give its own image — which is most of them
  //    — with the brand's chosen card instead of the generated one. Same signed
  //    descriptor shape as the per-page image, so the same proxy path applies,
  //    including the "upstream unreachable ⇒ keep falling through" behavior. A
  //    site with no default configured is unchanged (page image, else card).
  const siteDefaultOg = getSignedUrl(siteData.defaultOgImage);
  if (siteDefaultOg.startsWith('http')) {
    const proxied = await proxyImageBytes(siteDefaultOg);
    if (proxied) return withDemoRobotsHeader(proxied, isDemo);
  }

  // 2. Generate a branded card.
  const heading = resolvePageOgHeading(pageConfig, {
    staticTitle: slug === 'home' ? siteName : undefined,
    siteName,
    slug,
  });

  return withDemoRobotsHeader(
    await renderBrandedOgCard({
      heading,
      siteName,
      logoSrc: getSignedUrl(siteData.logo),
      background: siteData.primary || '#0f172a',
    }),
    isDemo,
  );
}
