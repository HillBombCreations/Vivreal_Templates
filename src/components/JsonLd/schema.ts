/**
 * Pure JSON-LD payload builders, split out of ./index.tsx.
 *
 * index.tsx carries JSX (the <script> component), and `node
 * --experimental-strip-types` cannot load a .tsx file at all, so anything
 * living there can only ever be covered by asserting on its source text. The
 * site-level builder below now carries a demo-safety gate, and a gate with no
 * behavioural test is exactly the failure mode review-templates-106.md B2
 * documented. Moving these two pure functions here makes the gate callable
 * from a test. index.tsx re-exports both, so every existing import of
 * `@/components/JsonLd` is unchanged.
 *
 * Imports `../../lib/og/siteOrigin.ts` directly rather than `@/lib/og/ogImage`:
 * relative + explicit extension for the test runner, and it keeps `server-only`
 * off this module so JsonLd does not become transitively server-only (a
 * component whose job is emitting a <script> tag is a plausible thing to render
 * from a client boundary someday).
 */
import type { SiteData } from '@/types/SiteData';
import { unsignMediaUrl } from './unsignMediaUrl.ts';
import { isDemoSite } from '../../lib/seo/demoSafety.ts';
import { resolveSiteOrigin } from '../../lib/og/siteOrigin.ts';

/**
 * Build the site-level JSON-LD payload (Organization or LocalBusiness +
 * WebSite). Emitted from root layout so it appears on every page.
 */
export function buildSiteJsonLd(siteData: SiteData): Array<Record<string, unknown>> {
  const siteName =
    siteData.businessInfo?.name || siteData.name || 'Website';
  // SEO demo-safety: robots.txt and the sitemap already withhold themselves
  // from a pre-cutover demo. JSON-LD `url` had no matching gate, so a demo
  // emitted its own `<sub>.vivreal.io` origin here while the layout canonical
  // simultaneously pointed at the prospect's real site: two contradictory
  // ownership signals in one document. Gated the same way for symmetry.
  //
  // `durable`, not `deployed`: JSON-LD lives in crawler caches for days, so an
  // Amplify build host is refused rather than published.
  const url = isDemoSite(siteData)
    ? undefined
    : resolveSiteOrigin(siteData, { surface: 'durable' }) || undefined;
  const description = siteData.businessInfo?.description;
  // Strip CloudFront signing params before embedding in JSON-LD — the
  // signed form expires after 300s but JSON-LD lives in crawler caches
  // for days/weeks. See ./unsignMediaUrl.ts for the full rationale.
  const logoUrl = unsignMediaUrl(siteData.logo?.currentFile?.source);
  const email = siteData.businessInfo?.contactInfo?.email;
  const phone = siteData.businessInfo?.contactInfo?.phoneNumber;
  const address = siteData.businessInfo?.address;
  const socialLinks = (siteData.socialLinks ?? [])
    .map((s) => s.link)
    .filter((link): link is string => Boolean(link));

  // Promote to LocalBusiness if we have a physical address; otherwise
  // Organization is the safer default (also valid for service businesses).
  const hasAddress = Boolean(
    address?.street1 || address?.city || address?.state || address?.zip
  );

  const orgBase: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': hasAddress ? 'LocalBusiness' : 'Organization',
    name: siteName,
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
    ...(logoUrl ? { logo: logoUrl, image: logoUrl } : {}),
    ...(email ? { email } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(socialLinks.length ? { sameAs: socialLinks } : {}),
    ...(hasAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(address?.street1
              ? {
                  streetAddress: [address.street1, address.street2]
                    .filter(Boolean)
                    .join(' '),
                }
              : {}),
            ...(address?.city ? { addressLocality: address.city } : {}),
            ...(address?.state ? { addressRegion: address.state } : {}),
            ...(address?.zip ? { postalCode: address.zip } : {}),
          },
        }
      : {}),
  };

  const websiteSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
  };

  return [orgBase, websiteSchema];
}

/**
 * Build JSON-LD for a single content detail page. Discriminates on the page
 * `format` to pick the most appropriate schema.org type. Falls back to
 * `Article` for unknown formats so we always emit something useful.
 */
export interface DetailJsonLdInput {
  format?: string;
  title: string;
  description?: string;
  imageUrl?: string;
  url?: string;
  // Event-specific
  startDate?: string;
  location?: string;
  // Product-specific
  price?: number | string;
  currency?: string;
  sku?: string;
  // Article-specific
  authorName?: string;
  datePublished?: string;
}

export function buildDetailJsonLd(
  input: DetailJsonLdInput
): Record<string, unknown> {
  // Strip CloudFront signing params from imageUrl before embedding —
  // signed URLs expire after 300s but JSON-LD is crawler-cached for days.
  // See ./unsignMediaUrl.ts for the full rationale.
  const cleanImage = unsignMediaUrl(input.imageUrl);
  const base: Record<string, unknown> = {
    '@context': 'https://schema.org',
    name: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(cleanImage ? { image: cleanImage } : {}),
    ...(input.url ? { url: input.url } : {}),
  };

  switch (input.format) {
    case 'shows':
      return {
        ...base,
        '@type': 'Event',
        ...(input.startDate ? { startDate: input.startDate } : {}),
        ...(input.location
          ? { location: { '@type': 'Place', name: input.location } }
          : {}),
      };

    case 'products':
    case 'collection-list':
      // Only emit Product schema if we have at least a price — otherwise
      // it'll fail Google's Rich Results validator. Fall back to base Thing.
      if (input.price !== undefined) {
        return {
          ...base,
          '@type': 'Product',
          ...(input.sku ? { sku: input.sku } : {}),
          offers: {
            '@type': 'Offer',
            price: String(input.price),
            priceCurrency: input.currency || 'USD',
            availability: 'https://schema.org/InStock',
          },
        };
      }
      return { ...base, '@type': 'Thing' };

    default:
      return {
        ...base,
        '@type': 'Article',
        headline: input.title,
        ...(input.authorName
          ? { author: { '@type': 'Person', name: input.authorName } }
          : {}),
        ...(input.datePublished ? { datePublished: input.datePublished } : {}),
      };
  }
}
