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
  // Recipe-specific. Ingredients and steps are the AUTHORED lines, verbatim:
  // `recipeIngredient` wants exactly "500g bread flour", not a parsed
  // {amount, unit, item} we would only have to re-join.
  recipeIngredients?: string[];
  recipeInstructions?: string[];
  /** Whole minutes. Absent or zero ⇒ the field is omitted entirely. */
  prepMinutes?: number;
  cookMinutes?: number;
  /** Rising / proving / chilling. Has no schema.org field of its own; it is
   *  part of `totalTime`, which is why bread needs it. */
  restMinutes?: number;
  /** "1 loaf", "15 pieces". */
  recipeYield?: string;
  /**
   * A STABLE, publicly fetchable URL for the same picture `imageUrl` names,
   * used for `image` when present.
   *
   * `unsignMediaUrl` (see its doc comment) makes a media URL non-expiring by
   * stripping the CloudFront signature, and is honest that on THIS
   * distribution the stripped form 403s just like an expired one: the JSON-LD
   * `image` field is unusable today "regardless of approach". That is an
   * accepted degradation for the other shapes, where the image is optional and
   * the rest of the record still indexes.
   *
   * It is not acceptable for a Recipe. Google requires an image, an
   * unfetchable one means no rich result, and "your recipes can show up in
   * Google with your photo next to them" is the entire owner-facing promise.
   * The `/og/<slug>/<itemId>` route is the URL that solves it: it is public,
   * it never expires, and it re-signs and re-fetches the item's media on every
   * request, so what a crawler pulls tomorrow is the picture she uploaded.
   *
   * The Recipe/Article decision is still made on `imageUrl`, so a recipe with
   * no photo of its own is still an Article — this field changes where the
   * picture is READ from, never whether one exists.
   */
  durableImageUrl?: string;
}

/**
 * Minutes → an ISO 8601 duration (`PT45M`, `PT1H`, `PT13H5M`).
 *
 * Returns undefined for absent, zero, or anything not a positive finite
 * number, so a caller can spread the result away rather than emit `PT0M` —
 * a recipe with no rising time must have no rising time, not a zero one.
 *
 * This is the MACHINE-readable form and is deliberately not the human one:
 * the owner-facing strip renders "13 hrs 5 mins".
 */
export function toIso8601Duration(minutes: number | undefined): string | undefined {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    return undefined;
  }
  const whole = Math.floor(minutes);
  const hours = Math.floor(whole / 60);
  const mins = whole % 60;
  return `PT${hours ? `${hours}H` : ''}${mins ? `${mins}M` : ''}`;
}

/**
 * A calendar date we are willing to publish as `datePublished`.
 *
 * `objectValue` is Mongo Mixed, so the stored value is whatever the CMS wrote:
 * an ISO date, an ISO timestamp, or free text like "Autumn 2026". Emitting the
 * last one would fail validation for the whole recipe, so only a leading
 * `YYYY-MM-DD` is accepted.
 */
function asPublishDate(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}/.test(value) ? value : undefined;
}

/**
 * The Article shape, used both by the `default` arm and as the Recipe arm's
 * fallback when there is no image to satisfy Google's Recipe requirements.
 */
function buildArticleJsonLd(
  base: Record<string, unknown>,
  input: DetailJsonLdInput,
): Record<string, unknown> {
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

    case 'recipes': {
      // Google's Recipe rich results REQUIRE an image. A photo-less recipe
      // therefore falls back to Article rather than emitting a Recipe that
      // fails validation — the same guard shape the products arm above applies
      // to a missing price, for the same reason.
      if (!cleanImage) return buildArticleJsonLd(base, input);

      // Total time is DERIVED, never authored: prep + cook + rest. One less
      // number for the owner to keep in sync, and it can never contradict its
      // own parts. Bread is why `rest` is in the sum at all — a 12 hour
      // overnight ferment is most of a loaf's total time.
      const parts = [input.prepMinutes, input.cookMinutes, input.restMinutes].filter(
        (part): part is number => typeof part === 'number' && Number.isFinite(part) && part > 0,
      );
      const totalTime = toIso8601Duration(
        parts.length ? parts.reduce((sum, part) => sum + part, 0) : undefined,
      );
      const prepTime = toIso8601Duration(input.prepMinutes);
      const cookTime = toIso8601Duration(input.cookMinutes);
      const datePublished = asPublishDate(input.datePublished);

      return {
        ...base,
        '@type': 'Recipe',
        // Overrides `base.image`. See `durableImageUrl` for why a Recipe
        // cannot ship the same knowingly-unfetchable URL the other shapes do.
        ...(input.durableImageUrl ? { image: input.durableImageUrl } : {}),
        ...(input.recipeIngredients?.length
          ? { recipeIngredient: input.recipeIngredients }
          : {}),
        ...(input.recipeInstructions?.length
          ? {
              recipeInstructions: input.recipeInstructions.map((text) => ({
                '@type': 'HowToStep',
                text,
              })),
            }
          : {}),
        ...(prepTime ? { prepTime } : {}),
        ...(cookTime ? { cookTime } : {}),
        ...(totalTime ? { totalTime } : {}),
        ...(input.recipeYield ? { recipeYield: input.recipeYield } : {}),
        // Organization, not Person: the author of a bakery's recipe is the
        // bakery. Google accepts either.
        ...(input.authorName
          ? { author: { '@type': 'Organization', name: input.authorName } }
          : {}),
        ...(datePublished ? { datePublished } : {}),
      };
    }

    default:
      return buildArticleJsonLd(base, input);
  }
}
