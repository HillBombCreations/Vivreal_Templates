/**
 * RT5-176 (owner decision, 2026-10-11): a live site never prints an untouched
 * kit SEED INSTRUCTION ("Placeholder policy text. Replace with your own before
 * you go live."). The page body is handled by the renderer from 1.85.4
 * (`vivreal-site-renderer` `src/lib/seedCopy.ts`); this is the same rule for
 * the meta, Open Graph and JSON-LD descriptions this repo builds itself, so a
 * search result or a shared link never quotes the instruction either.
 *
 * A LOCAL MIRROR, deliberately. The renderer exports the rule from its package
 * entry point, but that entry point cannot load under plain `node --test` (it
 * pulls `next/link`, which Node's ESM resolver cannot find without Next's
 * bundler), and the package `exports` map does not expose `dist/lib/seedCopy.js`
 * on its own. This module and its callers must stay import-free to stay
 * testable, so the rule is mirrored, and `seedCopy.test.ts` loads the INSTALLED
 * renderer's `dist/lib/seedCopy.js` by file URL and fails if the two ever
 * disagree, on the verdict AND on the text a partly seeded value keeps.
 *
 * NAMES. The renderer's value-level function is `withoutSeedText`; its
 * `withoutSeedCopy` is item-level (`ContentItem -> ContentItem | null`). Here
 * `withoutSeedCopy` is the VALUE-level one, the renderer's `withoutSeedText`
 * under the name this repo's callers already use. `isUnfilledSeedCopy` is the
 * same function in both.
 *
 * The mirror must agree with the renderer EXACTLY, HTML stripping included,
 * which is why it does NOT reuse `plainMeta`: the renderer's `plainExcerpt`
 * turns EVERY tag into a space (so `Place<span>holder</span>` is two words),
 * drops script/style/comments with their contents, and decodes numeric and
 * named entities (1.85.6 table), and `plainMeta` does none of those.
 *
 * The rule (renderer 1.85.7, W25f-1), case-insensitive, on the text with HTML
 * stripped:
 *  - LEGACY (1.85.4): the WHOLE value begins with "Placeholder" and contains
 *    "replace with";
 *  - `SEED_WORDINGS` (1.85.7): a CLOSED list of the exact kit wordings, with
 *    only bounded gaps, matched at the start of a sentence (`SB`) wherever that
 *    sentence sits, so "<subject>. Illustrative placeholder photography, not a
 *    patient result." is found mid-value and "No illustrative placeholder
 *    photography here." is not.
 *
 * WHAT IS HIDDEN (`withoutSeedCopy`):
 *  - a value whose seed starts in its FIRST sentence, or that the legacy rule
 *    takes, is hidden whole (`undefined`), so the caller's own fallback runs;
 *  - otherwise only the seed is cut: whole `<p>` paragraphs or `<br>` lines
 *    that are seed, and inside a tagless paragraph, line or plain value, just
 *    the seed sentences. The owner's real paragraphs and sentences are kept;
 *  - a value left with no words, or still seed after cutting, is hidden whole.
 * A value with no seed copy is returned BY REFERENCE, so every site that has
 * replaced its seed copy gets byte-identical metadata.
 *
 * Pure, no imports, so it runs under plain `node --test`.
 */

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
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
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

// The renderer's `plainExcerpt(html, Infinity)` (its `visibleText`): with no length budget it never cuts.
function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/* ── From here to the end, the renderer's `src/lib/seedCopy.ts` at 99caa5b (1.85.7), verbatim in logic. ── */

/** Sentence start, as a bounded lookbehind so a match's index is the phrase itself. */
const SB = String.raw`(?<=^|[.!?…]["'’”)\]]{0,3}\s{1,8})`;
// The leading word goes first as a lookahead, so the engine rejects most
// positions on one character before it evaluates the lookbehind.
const atSentenceStart = (shape: string): RegExp => new RegExp(`(?=${/^[a-z]+/.exec(shape)?.[0] ?? ''})${SB}${shape}`, 'i');
const anywhere = (shape: string): RegExp => new RegExp(String.raw`\b` + shape, 'i');

/** The kit seed wordings, each named after the kit line it was taken from (see the renderer for the sources). */
const SEED_WORDINGS: ReadonlyArray<readonly [lead: string, shape: RegExp]> = [
  // "Placeholder biography, replace with ...", "Placeholder policy text. Replace with ...".
  ['placeholder', atSentenceStart(String.raw`placeholder(?:\s+[a-z’'-]{1,24}){0,4}\s*[,.]\s{1,8}replace with\b`)],
  // "Placeholder body copy for the journal entry titled “...”. Replace with your own writing ..."
  ['placeholder', atSentenceStart(String.raw`placeholder body copy for the journal entry titled “[^”]{1,120}”\.\s{1,8}replace with your own writing\b`)],
  // "Placeholder text. Most venues collect ..."
  ['placeholder', atSentenceStart(String.raw`placeholder text\.(?=\s|$)`)],
  // Juniper captions and Results subtitle.
  // eslint-disable-next-line vivreal/owner-visible-copy -- a regex matching the kit caption's own dash, never drawn as copy.
  ['illustrative', atSentenceStart(String.raw`illustrative placeholder photography(?:\.\s{1,8}replace with your own consented before-and-after set\.|\s{0,3}[,\u2014\u2013-]\s{0,3}not a patient result\.|\.(?=\s|$))`)],
  // "Template placeholder. This page is intentionally ..."
  ['template', atSentenceStart(String.raw`template placeholder\.\s{1,8}this page is\b`)],
  // "This is example (policy) text. Replace it with your own ..."
  ['this is', atSentenceStart(String.raw`this is example (?:policy )?text\.\s{1,8}replace it with your own\b`)],
  // "The set below is illustrative placeholder photography."
  ['the set', atSentenceStart(String.raw`the set below is illustrative placeholder photography\.`)],
  // "This is placeholder copy for a demonstration template. Replace it with your own story ..."
  ['this is', atSentenceStart(String.raw`this is placeholder copy for a demonstration template\.\s{1,8}replace it with your own\b`)],
  // "This is placeholder policy text supplied with the Vivreal template gallery. Replace it with ..."
  ['this is', atSentenceStart(String.raw`this is placeholder policy text supplied with the vivreal template gallery\.\s{1,8}replace it with your own\b`)],
  // "Placeholder press coverage (testimonials) for the demonstration template."
  ['placeholder', atSentenceStart(String.raw`placeholder (?:press coverage|testimonials) for the demonstration template\.`)],
  // "Example text. Describe your own step free routes, ..."
  ['example text', atSentenceStart(String.raw`example text\.\s{1,8}describe your own step free routes\b`)],
  // Credits: "... on this site are example content. Replace them ..." and "The words on this page are example copy. ..."
  ['on this', anywhere(String.raw`on this site are example content\.\s{1,8}replace them with your own before you go live\.`)],
  ['the words', atSentenceStart(String.raw`the words on this page are example copy\.\s{1,8}replace them with your own\.`)],
  // "... used here as placeholder art. Swap in your own before going live."
  ['used here', anywhere(String.raw`used here as placeholder art\.\s{1,8}swap in your own before going live\b`)],
  // "Every photograph here is a stock image. Swap them for your own before you go live."
  ['every photograph', atSentenceStart(String.raw`every photograph here is a stock image\.\s{1,8}swap them for your own before you go live\.`)],
  // "... stands in for your own. Swap it before going live."
  ['stands in', anywhere(String.raw`stands in for your own\.\s{1,8}swap it before going live\b`)],
];

const LEGACY_START = /^placeholder\b/i;
const LEGACY_INSTRUCTION = /replace with/i;

/**
 * Each wording is filed under its opening words. One literal scan of those
 * finds the few places a wording could start, and only the shapes filed under
 * that lead are tried there (sticky, at that index), so a long value costs one
 * linear pass, not one per shape.
 */
const SEED_AT = new Map<string, RegExp[]>();
for (const [lead, shape] of SEED_WORDINGS) SEED_AT.set(lead, [...(SEED_AT.get(lead) ?? []), new RegExp(shape.source, 'iy')]);
const SEED_LEAD = new RegExp(String.raw`\b(?:${[...SEED_AT.keys()].map((lead) => lead.replace(/ /g, String.raw`\s+`)).join('|')})\b`, 'gi');
const shapesAt = (lead: string): readonly RegExp[] => SEED_AT.get(lead.toLowerCase().replace(/\s+/g, ' ')) ?? [];

/** Index of the earliest kit wording in `text`, or -1. */
function seedStart(text: string): number {
  SEED_LEAD.lastIndex = 0;
  for (let lead = SEED_LEAD.exec(text); lead; lead = SEED_LEAD.exec(text)) {
    for (const shape of shapesAt(lead[0])) {
      shape.lastIndex = lead.index;
      if (shape.test(text)) return lead.index;
    }
  }
  return -1;
}

const isSeedText = (text: string): boolean => text !== '' && seedStart(text) >= 0;
const isLegacySeed = (text: string): boolean => LEGACY_START.test(text) && LEGACY_INSTRUCTION.test(text);

/** End of the first sentence of `text` (its length when it has one sentence). */
function firstSentenceEnd(text: string): number {
  const m = /[.!?…]["'’”)\]]{0,3}(?=\s|$)/.exec(text);
  return m ? m.index + m[0].length : text.length;
}

const PARAGRAPH = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
const LINE_BREAK = /(<br\s*\/?>)/i;
const WRAPPED = /^(\s*<p\b[^>]*>)([\s\S]*)(<\/p>\s*)$/i;
/** Sentence chunks; concatenated they are the input exactly. */
const SENTENCE = /[^.!?…]*(?:[.!?…]+["'’”)\]]{0,3})?\s*/g;

/** Every kit wording in `text` as [start, end) spans: one lead scan, the shapes tried only at each lead. */
function seedSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  SEED_LEAD.lastIndex = 0;
  for (let lead = SEED_LEAD.exec(text); lead; lead = SEED_LEAD.exec(text)) {
    for (const shape of shapesAt(lead[0])) {
      shape.lastIndex = lead.index;
      if (shape.test(text)) {
        spans.push([lead.index, shape.lastIndex]);
        SEED_LEAD.lastIndex = Math.max(SEED_LEAD.lastIndex, shape.lastIndex);
        break;
      }
    }
  }
  return spans;
}

/**
 * Tagless text with every sentence a kit wording touches cut out. When the
 * wording only reads as one after entity decoding, no span is found and the
 * whole text is cut, which errs towards hiding.
 */
function withoutSeedSentences(text: string): string {
  const spans = seedSpans(text);
  if (spans.length === 0) return '';
  const out: string[] = [];
  let at = 0;
  let s = 0;
  for (const chunk of text.match(SENTENCE) ?? []) {
    const end = at + chunk.length;
    while (s < spans.length && spans[s][1] <= at) s++;
    const touched = s < spans.length && spans[s][0] < end;
    if (!touched) out.push(chunk);
    at = end;
  }
  return out.join('').trimEnd();
}

/** One paragraph, line or plain value with its seed cut: the same string when it holds none, '' when nothing of it should stand. */
function withoutSeedSegment(segment: string): string {
  if (!isSeedText(visibleText(segment))) return segment;
  const wrapped = WRAPPED.exec(segment);
  const inner = wrapped ? wrapped[2] : segment;
  // Inline markup cannot be cut by sentence safely: the segment goes whole.
  if (inner.includes('<')) return '';
  const kept = withoutSeedSentences(inner);
  if (visibleText(kept) === '') return '';
  return wrapped ? `${wrapped[1]}${kept}${wrapped[3]}` : kept;
}

/** A run of line breaks, with any whitespace between them. */
const BREAK_RUN = /(?:<br\s*\/?>\s*)+/gi;
const BREAK_TAG = /<br\s*\/?>/gi;
const breaksIn = (run: string): string[] => run.match(BREAK_TAG) ?? [];

/**
 * `value` split on `<br>`, each line cut, a line emptied by the cut removed
 * with its break. A `<p>` wrapping the whole value is taken off first and put
 * back after; a run of breaks the cut leaves behind is shortened to the
 * longest run the value had, so no new gap appears.
 */
function withoutSeedLines(value: string): string {
  const wrapped = WRAPPED.exec(value);
  const inner = wrapped ? wrapped[2] : value;
  const parts = inner.split(LINE_BREAK);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    const kept = withoutSeedSegment(line);
    if (kept === '' && line !== '') continue;
    out.push(kept);
    if (i + 1 < parts.length) out.push(parts[i + 1]);
  }
  if (out.length > 0 && LINE_BREAK.test(out[out.length - 1])) out.pop();
  const longest = Math.max(0, ...(inner.match(BREAK_RUN) ?? []).map((run) => breaksIn(run).length));
  const joined = out.join('').replace(BREAK_RUN, (run) => {
    const breaks = breaksIn(run);
    return breaks.length > longest ? breaks.slice(0, longest).join('') : run;
  });
  return wrapped ? `${wrapped[1]}${joined}${wrapped[3]}` : joined;
}

/**
 * `value` with its seed copy removed (the renderer's `withoutSeedText`): the
 * SAME value when it holds none, `undefined` when it is seed as a whole, so
 * every caller's own "no description" fallback runs, otherwise the value with
 * only its seed paragraphs, lines or sentences cut.
 */
export function withoutSeedCopy<T>(value: T): T | string | undefined {
  if (typeof value !== 'string' || value === '') return value;
  const text = visibleText(value);
  if (isLegacySeed(text)) return undefined;
  const start = seedStart(text);
  if (start < 0) return value;
  if (start < firstSentenceEnd(text)) return undefined;
  const paragraphs = value.match(PARAGRAPH);
  const cut =
    paragraphs && paragraphs.length >= 2
      ? value.replace(PARAGRAPH, (p) => withoutSeedSegment(p))
      : LINE_BREAK.test(value)
        ? withoutSeedLines(value)
        : withoutSeedSegment(value);
  const rest = visibleText(cut);
  return cut === value || rest === '' || isSeedText(rest) ? undefined : cut;
}

/** True when `value` is a string whose visible text is, as a whole, an untouched kit seed instruction. */
export function isUnfilledSeedCopy(value: unknown): boolean {
  return typeof value === 'string' && value !== '' && withoutSeedCopy(value) === undefined;
}
