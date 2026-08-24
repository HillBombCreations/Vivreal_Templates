/**
 * JsonLd — server component that emits a JSON-LD `<script>` tag.
 *
 * Helps both classic search crawlers (Google rich results) and AI assistants
 * understand the structured content of each page. Stringifies the schema with
 * `JSON.stringify` and emits via `dangerouslySetInnerHTML` per Google's
 * recommended pattern (https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data).
 *
 * XSS safety:
 *   1. Inputs come from server-side fetches we control (siteData + page
 *      content), not from request URL params or user-form bodies.
 *   2. JSON.stringify on a plain object cannot produce raw `</script>` for
 *      primitive values.
 *   3. We additionally replace `<` with its unicode escape to defang any
 *      adversarial content field that contained literal `</script>` markup.
 *
 * Schema shapes used:
 *   - `WebSite` + `Organization` / `LocalBusiness` — emitted in root layout (every page)
 *   - `Product` — emitted on ecommerce detail pages with a price
 *   - `Event` — emitted on shows detail pages
 *   - `Article` — fallback for other content detail pages
 */
import type { SiteData } from '@/types/SiteData';
import { unsignMediaUrl } from './unsignMediaUrl';
import { resolveOrigin } from '@/lib/og/ogImage';
import { isDemoSite } from '@/lib/seo/demoSafety';

interface JsonLdProps {
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function JsonLd({ schema }: JsonLdProps) {
  // JSON-LD emission per Google's documented pattern. Inputs are
  // server-controlled (siteData + content from our own VR_Client_API); `<` is
  // defanged via unicode escape to belt-and-suspenders against any adversarial
  // content field containing literal `</script>`.
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, '\\u003c'),
      }}
    />
  );
}

/**
 * Build the site-level JSON-LD payload (Organization or LocalBusiness +
 * WebSite). Emitted from root layout so it appears on every page.
 */
export function buildSiteJsonLd(siteData: SiteData): Array<Record<string, unknown>> {
  const siteName =
    siteData.businessInfo?.name || siteData.name || 'Website';
  // SEO demo-safety: robots.txt (robots.tsx:30) and the sitemap
  // (siteData/index.tsx:354) already withhold themselves from a pre-cutover
  // demo. JSON-LD `url` had no matching gate — it would emit the demo's own
  // `<sub>.vivreal.io` origin here while the layout's canonical simultaneously
  // points at the prospect's real site (layout.tsx), a contradictory pair of
  // ownership signals in one document. Gated the same way for symmetry.
  const url = isDemoSite(siteData) ? undefined : resolveOrigin(siteData, { prefer: 'durable' }) || undefined;
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
