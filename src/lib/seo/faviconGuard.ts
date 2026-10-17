/**
 * The largest inline `data:` favicon this app will put into a page.
 *
 * Why a cap exists at all (V7.250, measured 2026-10-17): vivreal.io's site
 * document stores its favicon as a 221,164-character base64 PNG. A stored
 * favicon reaches each page FOUR times, the `<link rel="icon">`, that link's
 * row in the RSC payload, and once in every client component that receives
 * `siteData`. That was 81% of each gzipped page and 62% of the app's origin
 * bytes, on every page view, prefetch and 404.
 *
 * 4096 characters fits a real inline icon (a hand-written SVG or a 16 px PNG
 * is a few hundred) and refuses anything that is a full-size image. A hosted
 * URL is never capped: it costs its own length once, not its image's weight.
 */
export const MAX_INLINE_FAVICON_CHARS = 4096;

let warnedOversized = false;

/**
 * The favicon this site may serve, or `undefined` to serve none from siteData.
 *
 * `undefined` is the fallback, deliberately, rather than a fixed path such as
 * `/favicon.ico`: this app has no such file, so that href would 404 into the
 * full 404 shell. With no stored favicon Next's convention routes take over
 * (`src/app/icon.tsx` and `apple-icon.tsx`, drawn from the site's hosted logo
 * when it has one), which is what every site without a stored favicon serves.
 *
 * Accepts `unknown` because it validates a stored document field at the read
 * boundary.
 */
export function resolveServableFavicon(favicon: unknown): string | undefined {
  if (typeof favicon !== 'string' || favicon.trim() === '') return undefined;
  const isInline = favicon.trimStart().slice(0, 5).toLowerCase() === 'data:';
  if (!isInline || favicon.length <= MAX_INLINE_FAVICON_CHARS) return favicon;
  // Once per process: one Amplify app serves one site, and an uncached 404
  // renders on every scanner hit, so a per-call warning would repeat
  // thousands of times a day. The length only, never the value.
  if (!warnedOversized) {
    warnedOversized = true;
    console.warn(
      `[favicon] stored favicon is an inline data: URI of ${favicon.length} characters ` +
        `(cap ${MAX_INLINE_FAVICON_CHARS}); not served, the /icon route is used instead. ` +
        'Replace it with a hosted file on the site document.'
    );
  }
  return undefined;
}
