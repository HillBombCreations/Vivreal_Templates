/**
 * Drop inline rich-text image URLs that are dead, or about to be, from a floor
 * answer. vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 7.
 *
 * Every page image a site renders is a stable `client.vivreal.io/media` link
 * with no expiry, which works from a floor of any age. Inline rich-text images
 * are the exception: VR_Client_API signs them as CloudFront canned-policy URLs
 * at read time with a 24 h `Expires` (seconds since the epoch, a query value),
 * because the renderer's sanitiser accepts only `media.vivreal.io` sources. A
 * floor older than that carries dead ones.
 *
 * Removing the entry is the safe answer: the renderer already drops an inline
 * image with no address, so the text stays and the picture is omitted, never
 * broken. The margin (900 s) is longer than a floor page's life in the caches
 * (300 s at the origin plus 300 s at the edge), so nothing pruned "just in
 * time" expires on a page a visitor is looking at.
 *
 * A URL this cannot read an expiry from is KEPT untouched: this module only
 * removes what it can prove is dead.
 *
 * Plain module (T5).
 */

export const RICH_TEXT_EXPIRY_MARGIN_MS = 900_000;

/** The canned-policy expiry of a signed URL in epoch ms, or null when it has none readable. */
function expiresAtMs(url: string): number | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not a URL at all: nothing to prove, so the caller keeps it.
    return null;
  }
  const raw = parsed.searchParams.get('Expires');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw) * 1000;
}

export function pruneExpiredRichTextUrls(
  map: Record<string, string>,
  nowMs: number,
  marginMs: number = RICH_TEXT_EXPIRY_MARGIN_MS,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, url] of Object.entries(map ?? {})) {
    const expires = typeof url === 'string' ? expiresAtMs(url) : null;
    if (expires !== null && expires <= nowMs + marginMs) continue;
    kept[key] = url;
  }
  return kept;
}
