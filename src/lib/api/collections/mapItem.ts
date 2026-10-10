/**
 * Pure raw-object → ContentItem mapping for collection & integration reads.
 *
 * Extracted from `./index.ts` (which is `server-only` and imports `next/*`, so
 * it cannot be loaded under plain Node) so this dependency-free logic can be
 * unit-tested directly with the repo's `node --test` harness. `index.ts`
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
 * Media fields that are never a picture, so the type-based scan skips them.
 * Contract C12 (OW7): a help row carries `video`, `videoDesktop` and
 * `videoCaptions` (a WebVTT file); F-C24 (v5 item 26) adds
 * `videoCaptionsDesktop`, the captions timed to the computer video. Without
 * this, a row with a video and no `image` would get the video's (or a
 * captions file's) URL as its picture. The fields themselves reach the
 * renderer's `readRowVideo` untouched through `raw`, already signed by
 * VR_Client_API.
 */
const NON_IMAGE_MEDIA_FIELDS: ReadonlySet<string> = new Set([
  'video',
  'videoDesktop',
  'videoCaptions',
  'videoCaptionsDesktop',
]);

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
  for (const [field, value] of Object.entries(objectValue)) {
    if (NON_IMAGE_MEDIA_FIELDS.has(field)) continue;
    const url = getSignedUrl(value);
    if (url) return { url, srcset: getSrcSet(value), artDirectedSources: getArtDirectedSources(value) };
  }
  return { url: '', srcset: '', artDirectedSources: [] };
}

/**
 * The URL schemes an item-authored link may use, lower-cased with the colon.
 *
 * AN ALLOWLIST, because the thing being defended against is a scheme nobody
 * listed. `javascript:` is the one that matters — React 19.1 renders a
 * `javascript:` `href` with a development-only warning and no refusal, and an
 * integration object's fields are owner-writable through the CMS, so an
 * injected one is stored cross-site scripting aimed at a customer's own
 * visitors. `data:` and `vbscript:` are the same shape.
 *
 * `http:` and `https:` are the real cases; `mailto:` and `tel:` are authored
 * on contact cards today. A value with NO scheme is left alone: a relative
 * path (`/about`, `#menu`) is how an internal link is authored here and
 * refusing those would break every one of them.
 */
const SAFE_LINK_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * An item-authored link, or an empty string when its scheme is not one a
 * link may use.
 *
 * THE STRIP BEFORE THE TEST IS THE WHOLE GUARD. A browser discards ASCII
 * control characters and whitespace while it reads a scheme, so a tab in the
 * middle of the word, or a leading NUL, navigates exactly as the bare scheme
 * does. Testing the string as written would read a different value than the
 * browser does, which is a guard that reports safe and is not.
 *
 * It filters by CODE POINT rather than matching a character class, because a
 * class spelling those code points has to be written as escapes, and an
 * escape is the one thing that does not survive every editor and generator
 * intact: a NUL written into this very file by the heredoc that first drafted
 * it made the whole module invisible to `grep`.
 *
 * The ORIGINAL string is returned on success, not the stripped one: the strip
 * exists to decide, never to rewrite a legitimate path.
 */
function safeLinkHref(value: string): string {
  const candidate = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join('');
  const scheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(candidate)?.[0].toLowerCase();
  if (!scheme) return value;
  return SAFE_LINK_SCHEMES.has(scheme) ? value : '';
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
  const trimmedLink = typeof link === 'string' ? link.trim() : '';
  // Scheme-guarded. A refused link becomes `undefined`, which is the same
  // value an item with no link at all produces, so every layout's existing
  // "no href" branch already handles it and nothing renders a dead anchor.
  const href = safeLinkHref(trimmedLink) || undefined;

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
