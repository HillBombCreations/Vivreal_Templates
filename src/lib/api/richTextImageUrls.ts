/**
 * H177 - the one place that decides what `richTextImageUrls` means on the wire.
 *
 * NO `server-only` IMPORT, DELIBERATELY. Every other module in this directory
 * has one, which makes them unloadable under `node --experimental-strip-types
 * --test` and therefore untestable. The two rules below are the entire
 * correctness of threading this map through the app, so they get pinned by a
 * test rather than by six copies of `?? {}` that each look obviously right.
 *
 * THE WIRE CONTRACT
 * -----------------
 * VR_Client_API v2.10.16 ships `richTextImageUrls` on the `data` envelope of
 * `/tenant/siteDetails`, `/tenant/collectionObjects` and
 * `/tenant/integrationObjects`, UNCONDITIONALLY. `{}` means "this payload
 * references no inline images", never "this API is too old to ask". So a
 * consumer must not branch on presence.
 *
 * This module still tolerates absence, and that is not a contradiction. A
 * payload cached by `unstable_cache` before the upgrade can still be served
 * from the Next.js Data Cache for up to its TTL, and the legacy bare-array
 * envelope has nowhere to carry a map at all. Both degrade to `{}`, which
 * resolves no keys, which is the renderer's existing fail-closed drop. The
 * contract is "always an object"; where that object comes from is this
 * module's problem and nobody else's.
 */

/** Always an object, so callers merge rather than guard. */
export type RichTextImageUrlMap = Record<string, string>;

/**
 * Read the map off one API envelope.
 *
 * Values are checked to be strings. That is not ceremony: these strings become
 * an `<img src>`, and while the renderer's sanitiser is the real boundary (it
 * keeps the tag only when the src host is the media CDN), handing it a number
 * or an object would produce a stringified `[object Object]` src that is
 * simply noise. A non-string value is DROPPED, which lands the image back in
 * the fail-closed path it was already in rather than inventing a new one.
 */
export function readRichTextImageUrls(raw: unknown): RichTextImageUrlMap {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const candidate = (raw as { richTextImageUrls?: unknown }).richTextImageUrls;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  const out: RichTextImageUrlMap = {};
  for (const [key, value] of Object.entries(candidate as Record<string, unknown>)) {
    if (typeof key === 'string' && key !== '' && typeof value === 'string' && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Merge every map a page read into the one the renderer's resolver will use.
 *
 * Later sources win. Callers pass the SHELL's map first and the per-page reads
 * after, so a page-scoped signature beats a shell-scoped one for the same key.
 * In practice they cannot disagree meaningfully: a key is a storage path, so
 * two sources carrying it carry the same image, signed inside the same read
 * window.
 *
 * Nullish entries are skipped so a caller can splat an optional map without a
 * guard at every call site.
 */
export function mergeRichTextImageUrls(
  ...maps: (RichTextImageUrlMap | undefined | null)[]
): RichTextImageUrlMap {
  const out: RichTextImageUrlMap = {};
  for (const map of maps) {
    if (!map) continue;
    for (const [key, value] of Object.entries(map)) {
      if (typeof value === 'string' && value !== '') out[key] = value;
    }
  }
  return out;
}
