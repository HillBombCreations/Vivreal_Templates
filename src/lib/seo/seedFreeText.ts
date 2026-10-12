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
 * Pure, so it runs under `node --test`.
 */
import { withoutSeedCopy } from './seedCopy.ts';

/** Tags stripped and cut to `max`, from the seed-free value; `undefined` when nothing real is left. */
export function seedFreeText(value: unknown, max: number): string | undefined {
  const kept = withoutSeedCopy(value);
  if (typeof kept !== 'string' || kept === '') return undefined;
  return kept.replace(/<[^>]*>/g, '').slice(0, max);
}
