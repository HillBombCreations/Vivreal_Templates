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
 * The rule (renderer 1.85.8, W25tc-1), case-insensitive, on the text with HTML
 * stripped:
 *  - LEGACY (1.85.4): the WHOLE value begins with "Placeholder" and contains
 *    "replace with", unless it opens with a disclaimer ("Placeholder
 *    photography.", "Placeholder biography,"), which takes the cut instead;
 *  - `SEED_WORDINGS`: a CLOSED list of the exact kit INSTRUCTIONS to the owner,
 *    with only bounded gaps, matched at the start of a sentence (`SB`) wherever
 *    that sentence sits. A DISCLAIMER telling a visitor an image or the site's
 *    content is not real ("Illustrative placeholder photography, not a patient
 *    result.") is never seed and stays.
 *
 * WHAT IS HIDDEN (`withoutSeedCopy`):
 *  - a value whose seed starts in its FIRST sentence, or that the legacy rule
 *    takes, is hidden whole (`undefined`), so the caller's own fallback runs;
 *  - a mixed line keeps its disclaimer and loses the instruction after it, but
 *    any words after that instruction hide the whole line;
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

/* ── From here to the end, the renderer's `src/lib/seedCopy.ts` at 8caec57 (1.85.8), verbatim in logic. ── */

/** What may precede a sentence: the start of the text, or closing punctuation, any closing quote or bracket, then space. */
const SENTENCE_GAP = String.raw`(?:^|[.!?…]["'’”)\]]{0,3}\s{1,8})`;
/** Sentence start, as a bounded lookbehind so a match's index is the phrase itself. */
const SB = `(?<=${SENTENCE_GAP})`;
// The leading word goes first as a lookahead, so the engine rejects most
// positions on one character before it evaluates the lookbehind.
const atSentenceStart = (shape: string): RegExp => new RegExp(`(?=${/^[a-z]+/.exec(shape)?.[0] ?? ''})${SB}${shape}`, 'i');
/** Sources of the `afterDisclaimer` shapes: a match there never makes a value "seed from its first sentence". */
const DISCLAIMER_LED = new Set<string>();
/**
 * W25tc-1 (1.85.8): the INSTRUCTION half of a kit line whose first half is a
 * visitor DISCLAIMER. Only the instruction is the match (the disclaimer is a
 * lookbehind), so the cut keeps the disclaimer sentence and drops the
 * instruction. The disclaimer is a fixed phrase, so the lookbehind is bounded.
 */
const afterDisclaimer = (disclaimer: string, instruction: string): RegExp => {
  const shape = new RegExp(String.raw`(?<=${disclaimer}\s{1,8})${instruction}`, 'i');
  DISCLAIMER_LED.add(shape.source);
  return shape;
};
/** "Swap in your own before going live", with the kit's closing clause or sentence about why, so it goes too. */
const goingLive = (swap: string): string =>
  String.raw`${swap} before going live(?:[,.]\s{1,8}your [a-z]{1,24} (?:is|are) the reason someone books\.|\b)`;

/**
 * The kit seed wordings, each named after the kit line it was taken from.
 * Every gap is bounded and every phrase ends where the kit line does, so a
 * reviewer can check the list is closed and each match is linear.
 *
 * INSTRUCTIONS ONLY (W25tc-1, 1.85.8). A wording here is an instruction to
 * the OWNER ("Replace with ...", "Swap them for your own before you go
 * live."). A DISCLAIMER that tells a VISITOR an image or the site's content is
 * not real ("Illustrative placeholder photography, not a patient result.",
 * "Every photograph here is a stock image.", "... on this site are example
 * content.") is honest labelling, not seed, and is never hidden: removing
 * Juniper's left two different stock people as a before-and-after under a line
 * calling the comparison real. A kit line that is both keeps its disclaimer
 * sentence and loses the instruction (`afterDisclaimer`).
 */
const SEED_WORDINGS: ReadonlyArray<readonly [lead: string, shape: RegExp]> = [
  // Bios, notes, journal entries, policy, terms and captions:
  // "Placeholder biography, replace with ...", "Placeholder note. Replace with ...",
  // "Placeholder policy text. Replace with your own before you go live.",
  // "Placeholder text message terms. Replace with ...". At most four words
  // between, then a comma or a full stop, then "replace with" straight away.
  // Not "Placeholder photography.", "Placeholder biography" or "Placeholder
  // note": each is a disclaimer about photos or a person (below).
  ['placeholder', atSentenceStart(String.raw`placeholder(?!\s+photography\.|\s+(?:biography|note)[,.])(?:\s+[a-z’'-]{1,24}){0,4}\s*[,.]\s{1,8}replace with\b`)],
  // Journal bodies: "Placeholder body copy for the journal entry titled “...”.
  // Replace with your own writing before publishing."
  ['placeholder', atSentenceStart(String.raw`placeholder body copy for the journal entry titled “[^”]{1,120}”\.\s{1,8}replace with your own writing\b`)],
  // Venue policy and accessibility: "Placeholder text. Most venues collect ...".
  ['placeholder', atSentenceStart(String.raw`placeholder text\.(?=\s|$)`)],
  // Juniper Results subtitle: "Illustrative placeholder photography. Replace
  // with your own consented before-and-after set." keeps its first sentence.
  // Its captions ("..., not a patient result.") and the /before-after line
  // ("The set below is illustrative placeholder photography.") are
  // disclaimers with no instruction, so no wording names them.
  ['replace with', afterDisclaimer(`${SENTENCE_GAP}illustrative placeholder photography\\.`, String.raw`replace with your own consented before-and-after set\.`)],
  // Halo look book: "Placeholder photography. Replace with your own before and after set."
  ['replace with', afterDisclaimer(`${SENTENCE_GAP}placeholder photography\\.`, String.raw`replace with your own before and after set\.`)],
  // Med-spa legal pages: "Template placeholder. This page is intentionally ...".
  ['template', atSentenceStart(String.raw`template placeholder\.\s{1,8}this page is\b`)],
  // Venue policy: "This is example (policy) text. Replace it with your own privacy policy ...".
  ['this is', atSentenceStart(String.raw`this is example (?:policy )?text\.\s{1,8}replace it with your own\b`)],
  // Juniper /about: "This is placeholder copy for a demonstration template.
  // Replace it with your own story before publishing."
  ['this is', atSentenceStart(String.raw`this is placeholder copy for a demonstration template\.\s{1,8}replace it with your own\b`)],
  // Demo policy: "This is placeholder policy text supplied with the Vivreal
  // template gallery. Replace it with your own privacy policy ..."
  ['this is', atSentenceStart(String.raw`this is placeholder policy text supplied with the vivreal template gallery\.\s{1,8}replace it with your own\b`)],
  // People: "Placeholder biography, replace with Priya's training ..." (or a
  // full stop) and "Placeholder note. Replace with how long they have been
  // cutting ...". The disclaimer stays ("Placeholder biography."); after a
  // comma only the clause from "replace with" goes (`withoutSeedSentences`).
  // Juniper /press and /testimonials ("Placeholder press coverage
  // (testimonials) for the demonstration template.") are disclaimers with no
  // instruction and stay whole. Any sentence after one is kit text (review
  // C1: "... Swap these for real quotes."): it goes, and with more after it
  // the whole line goes. The disclaimer is the `keep` group, never cut.
  ['placeholder', atSentenceStart(String.raw`(?<keep>placeholder (?:press coverage|testimonials) for the demonstration template\.\s{1,8})[^\s.!?][^.!?]{0,199}[.!?]`)],
  ['replace with', afterDisclaimer(`${SENTENCE_GAP}placeholder (?:biography|note)[.,]`, String.raw`replace with\b`)],
  // Blackbird accessibility: "Example text. Describe your own step free routes, ..."
  ['example text', atSentenceStart(String.raw`example text\.\s{1,8}describe your own step free routes\b`)],
  // Credits, each keeping its disclaimer sentence and losing the instruction:
  // "The properties, pricing, ... on this site are example content. Replace
  // them with your own before you go live." and "The words on this page are
  // example copy. Replace them with your own."
  ['replace them', afterDisclaimer(String.raw`\bon this site are example content\.`, String.raw`replace them with your own before you go live\.`)],
  ['replace them', afterDisclaimer(`${SENTENCE_GAP}the words on this page are example copy\\.`, String.raw`replace them with your own\.`)],
  // Larkspur credits: "... used here as placeholder art. Swap in your own before going live(, or .) Your rooms are the reason someone books."
  ['swap in', afterDisclaimer(String.raw`\bused here as placeholder art\.`, goingLive('swap in your own'))],
  // Blackbird credits: "Every photograph here is a stock image. Swap them for
  // your own before you go live."
  ['swap them', afterDisclaimer(`${SENTENCE_GAP}every photograph here is a stock image\\.`, String.raw`swap them for your own before you go live\.`)],
  // Fernbrook and Windward credits: "... stands in for your own. Swap it before going live(, or .) Your gardens are ..."
  ['swap it', afterDisclaimer(String.raw`\bstands in for your own\.`, goingLive('swap it'))],
];

const LEGACY_START = /^placeholder\b/i;
const LEGACY_INSTRUCTION = /replace with/i;
/**
 * A value opening with a disclaimer sentence that the legacy rule would
 * otherwise hide whole (Halo: "Placeholder photography. Replace with ...").
 * It takes the cut instead, which keeps the disclaimer.
 */
const DISCLAIMER_OPENING = /^placeholder (?:photography\.(?=\s|$)|biography[,.]|note[,.])/i;

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

/** The earliest kit wording in `text`: its index, and whether it follows a disclaimer. Null when there is none. */
function seedMatch(text: string): { index: number; disclaimerLed: boolean } | null {
  const span = seedSpans(text, true)[0];
  return span ? { index: span[0], disclaimerLed: span[2] } : null;
}

/** Index of the earliest kit wording in `text`, or -1. */
const seedStart = (text: string): number => seedMatch(text)?.index ?? -1;

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
function seedSpans(text: string, firstOnly = false): Array<[start: number, end: number, disclaimerLed: boolean]> {
  const spans: Array<[number, number, boolean]> = [];
  SEED_LEAD.lastIndex = 0;
  for (let lead = SEED_LEAD.exec(text); lead; lead = SEED_LEAD.exec(text)) {
    for (const shape of shapesAt(lead[0])) {
      shape.lastIndex = lead.index;
      const m = shape.exec(text);
      if (m) {
        // A `keep` group is a disclaimer the shape had to read first; the span starts after it.
        const keep = m.groups?.keep?.length ?? 0;
        spans.push([lead.index + keep, shape.lastIndex, keep > 0 || DISCLAIMER_LED.has(shape.source)]);
        if (firstOnly) return spans;
        SEED_LEAD.lastIndex = Math.max(SEED_LEAD.lastIndex, shape.lastIndex);
        break;
      }
    }
  }
  return spans;
}

/**
 * Tagless text with every sentence a kit wording touches cut out. The spans
 * are found on the raw text; when the wording only reads as one after entity
 * decoding (`Placeholder&nbsp;note.`), no span is found and the whole text is
 * cut, which errs towards hiding.
 */
function withoutSeedSentences(text: string): string {
  const spans = seedSpans(text);
  if (spans.length === 0) return '';
  const out: string[] = [];
  let at = 0;
  let s = 0;
  // Review C1: a disclaimer is kept only when EVERYTHING after it is the
  // instruction. Any words after a disclaimer-led instruction ("Placeholder
  // note. Replace with ... Mention their best fade.") are more kit text no
  // wording names, so the whole segment goes, as 1.85.7 had it.
  let afterLedInstruction = false;
  for (const chunk of text.match(SENTENCE) ?? []) {
    const end = at + chunk.length;
    while (s < spans.length && spans[s][1] <= at) s++;
    const touched = s < spans.length && spans[s][0] < end;
    if (!touched) {
      if (afterLedInstruction && /\S/.test(chunk)) return '';
      out.push(chunk);
    } else {
      if (spans[s][2]) afterLedInstruction = true;
      // A disclaimer clause before a comma ("Placeholder biography, replace
      // with ...") is kept and closed with a full stop; any other touched
      // sentence goes whole.
      const lead = text.slice(at, Math.max(at, spans[s][0]));
      if (/\S,\s*$/.test(lead)) out.push(`${lead.replace(/,\s*$/, '.')}${/\s*$/.exec(chunk)?.[0] ?? ''}`);
    }
    at = end;
  }
  return out.join('').trimEnd();
}

/**
 * One paragraph, line or plain value with its seed cut: the same string when
 * it holds none, '' when nothing of it should stand.
 */
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
 * back after, so a cut last line never takes the closing `</p>` with it. A run
 * of breaks the cut leaves behind (a seed line between blank lines) is
 * shortened to the longest run the value had, so no new gap appears.
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
  const legacy = isLegacySeed(text);
  if (legacy && !DISCLAIMER_OPENING.test(text)) return undefined;
  const match = seedMatch(text);
  // A disclaimer opening whose instruction no wording names still goes whole, as the legacy rule had it.
  if (!match) return legacy ? undefined : value;
  // An instruction after a disclaimer is cut, even inside the first sentence (a comma clause).
  if (!match.disclaimerLed && match.index < firstSentenceEnd(text)) return undefined;
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
