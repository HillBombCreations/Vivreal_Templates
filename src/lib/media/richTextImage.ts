/**
 * Pictures inside a post body at an address that never expires (BLOG2,
 * vivreal-hq design-blog-inline-images-2026-10-23.md).
 *
 * A post body stores each inline picture as `<img data-media-key="K">`. The
 * renderer resolves K through the page's `RichTextImageProvider`; it used to
 * get a signed media URL that expires in minutes, so on a cached page the
 * picture broke. Now the detail page names `/img/<pageSlug>/<itemId>/<file>`
 * (`file` = the last segment of K), and that route signs and serves it.
 *
 * NOT A PROXY. The route looks the picture up in THIS site's own content: the
 * page it names, the item on that page, and only the keys stored in that
 * item's own body. `file` is compared for equality against those keys' last
 * segments, so it is a lookup key, never a path: `..`, an encoded slash, a
 * whole key or a query string match nothing. A picture another item stores is
 * never served under this one, even though the read signed it.
 *
 * ONE ADDRESS PER FILE NAME. When two keys in one body end in the same file
 * name, the first gets the stable address (the one the route serves) and the
 * second keeps its signed URL, so the address can never show the wrong picture.
 *
 * Pure: the renderer's helpers are passed in (its root barrel pulls
 * `next/link`, which plain Node cannot load), so it runs under `node --test`.
 */

export interface RichTextImageTools {
  /** The renderer's `collectRichTextImageKeys`. */
  collect: (html: string | null | undefined) => string[];
  /** The renderer's `stableRichTextImageUrl`. */
  stableUrl: (pageSlug: string, itemId: string, mediaKey: string) => string | undefined;
}

/** The address charset the renderer enforces on the file segment. */
const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

const fileOf = (key: string): string => key.split('/').pop() ?? '';

/** Every picture key the item's own text fields store, first seen first. */
function itemKeys(raw: Record<string, unknown> | undefined, collect: RichTextImageTools['collect']): string[] {
  const seen = new Set<string>();
  for (const value of Object.values(raw ?? {})) {
    if (typeof value !== 'string') continue;
    for (const key of collect(value)) seen.add(key);
  }
  return [...seen];
}

/**
 * The key each addressable file name stands for: the FIRST key ending in it,
 * and only names inside the address charset.
 */
function keysByFile(raw: Record<string, unknown> | undefined, collect: RichTextImageTools['collect']): Map<string, string> {
  const byFile = new Map<string, string>();
  for (const key of itemKeys(raw, collect)) {
    const file = fileOf(key);
    if (FILE.test(file) && !byFile.has(file)) byFile.set(file, key);
  }
  return byFile;
}

/** The stored key the route serves for `file` in this item's body, or `undefined`. */
export function richTextKeyForFile(
  raw: Record<string, unknown> | undefined,
  file: string,
  collect: RichTextImageTools['collect'],
): string | undefined {
  if (!FILE.test(file)) return undefined;
  return keysByFile(raw, collect).get(file);
}

/**
 * Key to stable address for this item's body pictures, for the detail page's
 * resolver map (merged OVER the signed map, so any key not here keeps its
 * signed URL). Empty when the page slug or item id is outside the charset.
 */
export function stableRichTextImageMap(
  pageSlug: string,
  itemId: string,
  raw: Record<string, unknown> | undefined,
  tools: RichTextImageTools,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keysByFile(raw, tools.collect).values()) {
    const url = tools.stableUrl(pageSlug, itemId, key);
    if (url) out[key] = url;
  }
  return out;
}
