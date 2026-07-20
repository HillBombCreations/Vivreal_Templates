/**
 * Pure raw-object → ContentItem mapping for collection & integration reads.
 *
 * Extracted from `./index.ts` (which is `server-only` and imports `next/*`, so
 * it cannot be loaded under plain Node) so this dependency-free logic can be
 * unit-tested directly with the repo's `node --test` harness — the same reason
 * `lib/heroBanner.ts` lives apart from its server-only callers. `index.ts`
 * re-imports `toContentItem` for its fetchers; behaviour is unchanged.
 */
// Explicit `.ts` extension (allowed by tsconfig `allowImportingTsExtensions`)
// so this module also loads under the repo's `node --test` harness, which does
// no extensionless / .js->.ts resolution — see `mapItem.test.ts`.
import { getSignedUrl, getSrcSet, getArtDirectedSources } from '../media.ts';
import type { ContentItem } from '@/types/ContentItem';

/**
 * Field names checked FIRST when resolving an object's image. This is only a
 * priority hint for disambiguation (when an object carries several media
 * fields) — NOT an allowlist. It exists to preserve the exact image currently
 * picked for the blueprint schemas; the type-based scan below resolves images
 * regardless of field name.
 */
const PREFERRED_IMAGE_FIELDS = ['image', 'productImage', 'photo', 'avatar', 'thumbnail'] as const;

/**
 * Resolve the signed image URL for an object by the field's TYPE, not its name.
 *
 * Users define their own schemas, so an image can live under any key
 * (`coverArt`, `poster`, `headshot`, `mugshot`, …). VR_Client_API only
 * populates `currentFile.source` on actual media fields, so `getSignedUrl(v)`
 * returning a non-empty string is a reliable structural signal that `v` is a
 * media descriptor — independent of what the field is called.
 *
 * Order: try the preferred fields first (deterministic, back-compatible pick
 * for the blueprint schemas), then scan every field and return the first whose
 * value is a media descriptor. `artDirectedSources` carries the RESOLVED
 * field's `{ primary, sources[] }` art-directed variants (WS4 6.1) — `[]` for a
 * plain single descriptor, so it always mirrors whichever field `url` came from.
 */
function resolveImage(objectValue: Record<string, unknown>): {
  url: string;
  srcset: string;
  artDirectedSources: Array<{ media: string; src: string; srcSet?: string }>;
} {
  // 1. Priority hint — keeps the existing pick for known blueprint fields.
  for (const field of PREFERRED_IMAGE_FIELDS) {
    const val = objectValue[field];
    const url = getSignedUrl(val);
    if (url) return { url, srcset: getSrcSet(val), artDirectedSources: getArtDirectedSources(val) };
  }
  // 2. Type-based fallback — any field whose value is a media descriptor,
  //    covering arbitrary user-defined schema keys.
  for (const value of Object.values(objectValue)) {
    const url = getSignedUrl(value);
    if (url) return { url, srcset: getSrcSet(value), artDirectedSources: getArtDirectedSources(value) };
  }
  return { url: '', srcset: '', artDirectedSources: [] };
}

/**
 * Map a raw API object to the unified ContentItem shape.
 */
export function toContentItem(
  raw: Record<string, unknown>,
  source: ContentItem['source'],
  integrationType?: string
): ContentItem {
  const objectValue = (raw.objectValue ?? {}) as Record<string, unknown>;

  const title = String(objectValue.title ?? objectValue.name ?? '');
  const description = objectValue.description ?? objectValue.bio ?? objectValue.review;
  const price = objectValue.price;
  const date = objectValue.date ?? raw.publishDate;
  const tags = Array.isArray(objectValue.tags) ? objectValue.tags.map(String) : undefined;
  const { url: imageUrl, srcset: imageSrcSet, artDirectedSources } = resolveImage(objectValue);
  // Item-authored link (`link` preferred over `url`, both common blueprint field
  // names). String fields only — a media field's descriptor object never matches.
  // Renderer layouts use this ONLY for sections without detail pages (detail
  // routes keep precedence in FeatureList/Cards; LinkCards always honored href),
  // so populating it does not reroute existing detail-enabled cards.
  const link = objectValue.link ?? objectValue.url;
  const href = typeof link === 'string' && link.trim() ? link.trim() : undefined;

  return {
    id: String(raw._id ?? ''),
    title,
    description: description != null ? String(description) : undefined,
    imageUrl: imageUrl || undefined,
    imageSrcSet: imageSrcSet || undefined,
    artDirectedSources: artDirectedSources.length ? artDirectedSources : undefined,
    price: price != null ? String(price) : undefined,
    date: date != null ? String(date) : undefined,
    href,
    tags,
    source,
    integrationType,
    raw: objectValue as Record<string, unknown>,
  };
}
