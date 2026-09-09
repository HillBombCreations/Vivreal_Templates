/**
 * Rich text to a meta description.
 *
 * WHY THIS EXISTS. Walk 4 C15: a recipe's `og:description` was the intro's
 * escaped HTML, so pasting the link into a chat previewed with a literal `<p>`.
 * The recipe metadata path did no stripping at all, because `summary` is
 * declared `longText` (the rich-text widget) and so legitimately holds markup,
 * while `readRecipeFields`'s `toText` is trim-only.
 *
 * WHY IT DECODES AS WELL AS STRIPS. Six other places in
 * `[slug]/[itemId]/page.tsx` already strip tags with the same
 * `replace(/<[^>]*>/g, '')`, and not one of them decodes entities. Stripping
 * alone turns `Salt &amp; pepper` into `Salt &amp; pepper` in the preview card,
 * which is the same class of defect one layer down: the reader sees markup.
 * A tag strip without an entity decode is half a job.
 *
 * Deliberately NOT a general HTML sanitiser. This output goes in a `<meta>`
 * content attribute and into JSON-LD, never into `dangerouslySetInnerHTML`, so
 * the goal is READABILITY, not safety. Nothing here should be reused to build
 * markup.
 */

// The entities a rich-text editor actually emits. Ampersand is applied LAST on
// purpose: decoding it first would turn the literal text `&amp;lt;` into `<`,
// inventing a tag the author never wrote.
const ENTITIES: Array<[RegExp, string]> = [
  [/&nbsp;/g, ' '],
  [/&#160;/g, ' '],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#0?39;/g, "'"],
  [/&apos;/g, "'"],
  [/&#x27;/gi, "'"],
  [/&amp;/g, '&'],
];

/**
 * Strip tags, decode the common entities, collapse whitespace, and cut to
 * `max` characters.
 *
 * Block-level tags become a SPACE rather than nothing. `<p>One</p><p>Two</p>`
 * stripped naively reads `OneTwo`, which is a worse preview than the markup was.
 *
 * @param html Rich text, or anything at all. A non-string returns undefined.
 * @param max Character budget. 160 for a meta description, 500 for JSON-LD.
 * @returns Plain text, or undefined when there was nothing to say.
 */
export function plainMeta(html: unknown, max: number): string | undefined {
  if (typeof html !== 'string') return undefined;
  let text = html
    // A block boundary is a word boundary. Inline tags (<em>, <strong>, <a>)
    // are removed without a space so `<em>very</em>good` does not gain one.
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  for (const [pattern, replacement] of ENTITIES) text = text.replace(pattern, replacement);
  text = text.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max).trim() : undefined;
}
