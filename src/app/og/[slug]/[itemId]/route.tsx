import { getSiteData } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { getSignedUrl } from '@/lib/api/media';
import { lookupDetailItem } from '@/lib/detail/lookupItem';
import { planOgItemCard, resolvePageOgHeading } from '@/lib/og/ogCard';
import { proxyImageBytes, renderBrandedOgCard } from '@/lib/og/ogCardRender';

/**
 * `/og/<slug>/<itemId>` — the social card for ONE item under a page.
 *
 * Detail items used to inherit the parent page's card, because the only OG
 * builder took the page slug. So every recipe pasted into a caption showed the
 * same picture, which is the whole thing recipes were asked for.
 *
 * Why this is a route and not the item's media URL: item media is a
 * CloudFront-SIGNED URL. A crawler fetches an `og:image` whenever it likes,
 * which is routinely hours after it first read the page, and a signature that
 * has expired by then serves 403 — a blank card, silently, on the exact link
 * she posted. This route is `force-dynamic`, re-reads the item and its freshly
 * signed URL on every request, and returns the BYTES rather than a redirect, so
 * the URL crawlers cache (`/og/<slug>/<itemId>`) has no expiry of its own at
 * all. That is the same reason `/og/[slug]` exists and it is the one property
 * neither route may lose.
 *
 * Deliberately generic rather than recipes-only: it resolves any page whose
 * detail route is served out of a CMS collection. Which pages EMIT this URL is
 * decided in `[slug]/[itemId]/page.tsx`'s `generateMetadata`, not here.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; itemId: string }> },
) {
  const { slug, itemId } = await params;

  const siteData = await getSiteData();
  const siteName = siteData.businessInfo?.name || siteData.name || '';
  const pageConfig = getPageBySlug(siteData, slug);
  const pageHeading = resolvePageOgHeading(pageConfig, { siteName, slug });

  // A missing page, a page addressing no collection, or an id that matches
  // nothing all land on the same safe answer: the page's own card. A social
  // card must never be the thing that 404s a shared link.
  const lookup = pageConfig ? await lookupDetailItem(siteData, pageConfig, itemId) : null;
  const plan = planOgItemCard(lookup?.item, pageHeading);

  if (plan.kind === 'photo') {
    const proxied = await proxyImageBytes(plan.signedUrl);
    if (proxied) return proxied;
    // else: upstream unreachable or the signature has aged out — fall through
    // to a card that still names THIS item.
  }

  return renderBrandedOgCard({
    heading: plan.heading,
    siteName,
    logoSrc: getSignedUrl(siteData.logo),
    background: siteData.primary || '#0f172a',
  });
}
