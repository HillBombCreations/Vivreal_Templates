/**
 * W25f-1: an item description for JSON-LD or a meta tag, with kit seed copy
 * removed FIRST and the result stripped and cut.
 *
 * Under renderer 1.85.7 `withoutSeedCopy` returns a partly seeded value CUT,
 * not unchanged, so a caller that only asks "is anything left?" and then
 * strips the ORIGINAL still publishes the seed sentence ("Three sessions over
 * six weeks. Illustrative placeholder photography, not a patient result.").
 * Every detail JSON-LD and meta description in `[slug]/[itemId]/page.tsx` goes
 * through here so the value that is cut is the value that is published.
 *
 * F-1 (v5 final walk, 2026-10-12): METADATA DROPS A DISCLOSURE-ONLY VALUE.
 * The seed rule (`./seedCopy.ts`, the renderer's) keeps a visitor disclosure
 * ("Placeholder journal entry.", "Placeholder biography.") because on the
 * PAGE it labels a person or an entry that is not real. As a whole search
 * description or shared-link card it says nothing and reads as a broken site,
 * so every metadata value (meta, Open Graph, Twitter, JSON-LD) goes through
 * `seedFreeMeta`, which runs the seed rule and then hides a value whose every
 * sentence is a disclosure, so the caller's own fallback runs. A value with a
 * real sentence keeps its disclosure (W25tc-1): Juniper's "... so the
 * comparison is a real one. The set below is illustrative placeholder
 * photography." would make a false claim without it. Metadata only; the page
 * body is untouched.
 *
 * Pure, so it runs under `node --test`.
 */
import { plainMeta } from './plainMeta.ts';
import { withoutSeedCopy } from './seedCopy.ts';

/**
 * The kit disclosure sentences, a CLOSED list, each matched as a WHOLE
 * sentence. Enumerated from every kit under `Vivreal_Site_Migrator/captures`
 * and the disclaimer halves the renderer 1.85.9 seed list keeps
 * (`./seedCopy.ts` `SEED_WORDINGS`). Closed and anchored for the reason the
 * renderer's list is: an owner's "Custom placeholder cards for weddings." or
 * "A demonstration of our template." is real copy and keeps its words.
 */
/** The em and en dash the kit captions use, by code point so the source holds no dash. */
const KIT_DASHES = String.fromCharCode(0x2014, 0x2013);
const DISCLOSURE_SENTENCES: readonly string[] = [
  String.raw`placeholder (?:note|journal entry|photography|body copy|biography|text|terms text|policy text|policy copy|accessibility text|text message terms)\.`,
  String.raw`placeholder (?:press coverage|testimonials) for the demonstration template\.`,
  String.raw`(?:the set below is )?illustrative placeholder photography(?:(?:,|\s[${KIT_DASHES}-]) not a patient result)?\.`,
  String.raw`this is placeholder copy for a demonstration template\.`,
  String.raw`(?:this is )?placeholder (?:policy )?text supplied with the vivreal template gallery\.`,
  String.raw`the [a-z ,]{1,120} on this site are example content\.`,
  String.raw`the words on this page are example copy\.`,
  String.raw`all photography is licensed from unsplash and (?:stands in for your own|used here as placeholder art)\.`,
  String.raw`every photograph here is a stock image\.`,
];
const DISCLOSURE = new RegExp(String.raw`^\s*(?:${DISCLOSURE_SENTENCES.join('|')})\s*$`, 'i');
/** Sentence chunks of plain text, each starting at a non-space. */
const SENTENCE = /[^.!?…]+(?:[.!?…]+["'’”)\]]{0,3})?\s*/g;

/**
 * A metadata value with its seed copy removed: the SAME value when it holds
 * none (so a site with real copy keeps byte-identical metadata), the seed
 * rule's cut otherwise, and `undefined` when nothing is left or every sentence
 * left is a kit disclosure.
 */
export function seedFreeMeta(value: unknown): string | undefined {
  const kept = withoutSeedCopy(value);
  if (typeof kept !== 'string' || kept === '') return undefined;
  const text = plainMeta(kept, Infinity);
  if (!text) return undefined;
  const sentences = text.match(SENTENCE) ?? [];
  return sentences.every((sentence) => DISCLOSURE.test(sentence)) ? undefined : kept;
}

/** Tags stripped and cut to `max`, from the seed-free value; `undefined` when nothing real is left. */
export function seedFreeText(value: unknown, max: number): string | undefined {
  const kept = seedFreeMeta(value);
  if (kept === undefined) return undefined;
  return kept.replace(/<[^>]*>/g, '').slice(0, max);
}
