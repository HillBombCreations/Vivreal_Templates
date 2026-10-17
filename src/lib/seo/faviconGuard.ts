/**
 * The largest inline `data:` favicon this app will put into a page.
 *
 * Why a cap exists at all (V7.250, measured 2026-10-17): vivreal.io's site
 * document stores its favicon as a 221,186-character base64 PNG data URI. A stored
 * favicon reaches each page FOUR times, the `<link rel="icon">`, that link's
 * row in the RSC payload, and once in every client component that receives
 * `siteData`. That was 81% of each gzipped page and 62% of the app's origin
 * bytes, on every page view, prefetch and 404.
 *
 * Sized from the writers and the stored data, not guessed. The Studio draws an
 * upload to a 64x64 canvas before encoding (Portal DesignEditor.tsx
 * FAVICON_PX), and a 64x64 RGBA PNG cannot exceed about 16.6 KB raw, about
 * 22,100 base64 characters. Measured 2026-10-17 across pod_01 and pod_02: 20
 * kit SVG favicons of 334 to 465 characters, one Studio PNG of 10,734, and
 * vivreal.io's 221,186. 32,768 keeps every Studio upload and refuses a
 * full-size image. A hosted URL is never capped: it costs its own length,
 * not its image's weight.
 */
export const MAX_INLINE_FAVICON_CHARS = 32_768;

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
