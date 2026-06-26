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
