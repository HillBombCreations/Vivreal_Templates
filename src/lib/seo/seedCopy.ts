/**
 * RT5-176 (owner decision, 2026-10-11): a live site never prints an untouched
 * kit SEED INSTRUCTION ("Placeholder policy text. Replace with your own before
 * you go live."). The page body is handled by the renderer from 1.85.4
 * (`vivreal-site-renderer` `src/lib/seedCopy.ts`, `isUnfilledSeedCopy`); this
 * is the same rule for the item meta and JSON-LD descriptions this repo builds
 * itself, so a shared link never previews the instruction either.
 *
 * A LOCAL MIRROR, deliberately, on renderer 1.85.4 and later. 1.85.4 exports
 * `isUnfilledSeedCopy` from its package entry point, but that entry point
 * cannot load under plain `node --test` (it pulls `next/link`, which Node's
 * ESM resolver cannot find without Next's bundler), and the package `exports`
 * map does not expose `dist/lib/seedCopy.js` on its own. This module and its
 * two callers must stay import-free to stay testable, so the rule is mirrored,
 * and `seedCopy.test.ts` loads the INSTALLED renderer's `dist/lib/seedCopy.js`
 * by file URL and fails if the two ever disagree. The renderer's own
 * `withoutSeedCopy` is item-level (`ContentItem -> ContentItem | null`); the
 * one here is value-level, a different function under the same name.
 * The mirror must agree with the renderer EXACTLY, HTML stripping included,
 * which is why it does NOT reuse
 * `plainMeta`: the renderer's `plainExcerpt` turns EVERY tag into a space (so
 * `Place<span>holder</span>` is two words), drops script/style/comments with
 * their contents, and decodes numeric entities, and `plainMeta` does none of
 * those. `seedCopy.test.ts` carries the renderer's test vectors verbatim.
 * 1.85.6 widened the entity decoding (named typographic, Latin-1 and the
 * en/em/thin spaces, exact case first), so the mirror takes that table too.
 *
 * The rule (renderer 1.85.5, decoding 1.85.6): the text, HTML stripped, case-insensitive,
 *  - BEGINS with "Placeholder" and CONTAINS "replace with" (1.85.4), or
 *  - BEGINS with one of `SEED_OPENERS` (1.85.5, W25r-2): "Placeholder text.",
 *    "Illustrative placeholder photography", "Template placeholder." and
 *    "This is example (policy) text. Replace it with".
 * A closed list, so real copy that merely mentions a placeholder, or asks a
 * reader to replace something, does not begin that way and is left alone.
 * The renderer also applies the rule to a section subtitle and a static
 * block body; neither is read here, so only the predicate is mirrored.
 *
 * Pure, no imports, so it runs under plain `node --test`.
 */

const SEED_START = /^placeholder\b/i;
const SEED_INSTRUCTION = /replace with/i;
// The renderer's `SEED_OPENERS` (1.85.5), verbatim.
const SEED_OPENERS = [
  /^placeholder text\./i,
  /^illustrative placeholder photography\b/i,
  /^template placeholder\./i,
  /^this is example (?:policy )?text\. replace it with\b/i,
];

// The renderer's `cardExcerpt.ts` entity table (1.85.6), verbatim. The three
// typographic spaces are written as escapes here so an editor cannot fold them
// into a plain space; the values are the renderer's own code points.
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  sbquo: '‚',
  bdquo: '„',
  lsaquo: '‹',
  rsaquo: '›',
  bull: '•',
  prime: '′',
  Prime: '″',
  dagger: '†',
  Dagger: '‡',
  permil: '‰',
  trade: '™',
  euro: '€',
  minus: '−',
  larr: '←',
  rarr: '→',
  harr: '↔',
  OElig: 'Œ',
  oelig: 'œ',
  Scaron: 'Š',
  scaron: 'š',
  Yuml: 'Ÿ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
};

// The renderer's HTML 4 Latin-1 names (1.85.6), verbatim, in code-point order from U+00A1.
const LATIN1 = (
  'iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr ' +
  'deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest ' +
  'Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ' +
  'ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig ' +
  'agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml ' +
  'eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
).split(' ');

// A Map, as in the renderer, so `&constructor;` cannot resolve to a prototype member.
const ENTITY_MAP = new Map<string, string>([
  ...LATIN1.map((name, i) => [name, String.fromCodePoint(0xa1 + i)] as [string, string]),
  ...Object.entries(ENTITIES),
]);

// The renderer's `decodeEntities` (1.85.6), verbatim: one pass, so `&amp;lt;`
// stays `&lt;`; exact name first (`&Eacute;` is not `&eacute;`), then lower-cased.
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITY_MAP.get(code) ?? ENTITY_MAP.get(code.toLowerCase()) ?? m;
  });
}

// The renderer's `plainExcerpt(html, Infinity)`: with no length budget it never cuts.
function seedText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when `value` is a string whose visible text is an untouched kit seed instruction. */
export function isUnfilledSeedCopy(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;
  const text = seedText(value);
  if (SEED_START.test(text) && SEED_INSTRUCTION.test(text)) return true;
  return SEED_OPENERS.some((opener) => opener.test(text));
}

/** `value` unchanged, or `undefined` when it is seed copy, so every caller's own "no description" fallback runs. */
export function withoutSeedCopy<T>(value: T): T | undefined {
  return isUnfilledSeedCopy(value) ? undefined : value;
}
