/**
 * Media URL utilities — resolves signed CloudFront URLs from API responses.
 *
 * CloudFront requires signed URLs. VR_Client_API generates these via
 * `signCloudFrontUrl.js` and returns them in `currentFile.source` on any
 * media field that has `mediaFields` configured. Templates should ALWAYS
 * use `currentFile.source` — unsigned URLs will 403.
 */

/**
 * Extract signed URL from a media field object.
 *
 * @param field - A media field object (e.g., image, logo, headshot, poster)
 *   Expected shape: { key, name, type, currentFile?: { source: string } }
 * @returns The signed CDN URL, or empty string if unavailable
 */
export function getSignedUrl(field: unknown): string {
  if (!field || typeof field !== 'object') return '';
  const f = field as Record<string, unknown>;

  // Standard shape: { currentFile: { source: signedUrl } }
  const direct = (f.currentFile as Record<string, string>)?.source;
  if (direct) return direct;

  // Variant shape: { variantName: { currentFile: { source } }, ... }
  // Pick the first variant that has a signed URL
  for (const val of Object.values(f)) {
    if (val && typeof val === 'object') {
      const sub = val as Record<string, unknown>;
      const subUrl = (sub.currentFile as Record<string, string>)?.source;
      if (subUrl) return subUrl;
    }
  }

  return '';
}

/**
 * Extract the responsive `srcset` from a media field, parallel to
 * {@link getSignedUrl}. VR_Client_API sets `currentFile.srcset` (signed
 * resized variants) only when derivatives exist; absent for pre-backfill /
 * non-image media — returns '' in that case so callers omit srcset.
 */
export function getSrcSet(field: unknown): string {
  if (!field || typeof field !== 'object') return '';
  const f = field as Record<string, unknown>;

  const direct = (f.currentFile as Record<string, string>)?.srcset;
  if (direct) return direct;

  for (const val of Object.values(f)) {
    if (val && typeof val === 'object') {
      const sub = (val as Record<string, unknown>).currentFile as Record<string, string> | undefined;
      if (sub?.srcset) return sub.srcset;
    }
  }

  return '';
}

/**
 * Art-directed variants of a media field's `{ primary, sources[] }` container
 * (WS4 6.1). The Migrator loader emits this container on a collection-object
 * image value; VR_CMS_API `processMediaFields` promotes it and VR_Client_API
 * signs each nested descriptor independently, so every entry carries its own
 * `media` query + signed `currentFile.source`/`.srcset`. Maps to the renderer's
 * `ContentItem.artDirectedSources`, which `ProductImage` renders as `<picture>`.
 *
 * Returns `[]` for a plain single descriptor (no `sources[]`), and drops any
 * entry missing a `media` query or a signed source URL — so a partially-signed
 * container degrades to whatever complete variants it has, never emitting a
 * `<source>` that would 403.
 */
export function getArtDirectedSources(
  field: unknown,
): Array<{ media: string; src: string; srcSet?: string }> {
  if (!field || typeof field !== 'object') return [];
  const sources = (field as Record<string, unknown>).sources;
  if (!Array.isArray(sources)) return [];

  const out: Array<{ media: string; src: string; srcSet?: string }> = [];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    const rec = s as Record<string, unknown>;
    const cf = rec.currentFile as Record<string, string> | undefined;
    const media = rec.media;
    const src = cf?.source;
    if (typeof media !== 'string' || !media || !src) continue; // drop incomplete
    out.push(cf.srcset ? { media, src, srcSet: cf.srcset } : { media, src });
  }
  return out;
}
