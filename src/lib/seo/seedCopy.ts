/**
 * RT5-176 (owner decision, 2026-10-11): a live site never prints an untouched
 * kit SEED INSTRUCTION ("Placeholder policy text. Replace with your own before
 * you go live."). The page body is handled by the renderer from 1.85.4
 * (`vivreal-site-renderer` `src/lib/seedCopy.ts`, `isUnfilledSeedCopy`); this
 * is the same rule for the item meta and JSON-LD descriptions this repo builds
 * itself, so a shared link never previews the instruction either.
 *
 * A LOCAL MIRROR, deliberately: the helper is new in renderer 1.85.4 and is not
 * exported by the installed 1.85.3. Keep the rule identical to the renderer's:
 * the text, HTML stripped, BEGINS with "Placeholder" and CONTAINS
 * "replace with", both case-insensitive. Real copy that merely mentions a
 * placeholder does not begin that way, so it is left alone.
 *
 * Pure, imports only a sibling, so it runs under plain `node --test`.
 */

import { plainMeta } from './plainMeta.ts';

const SEED_START = /^placeholder\b/i;
const SEED_INSTRUCTION = /replace with/i;

/** True when `value` is a string whose visible text is an untouched kit seed instruction. */
export function isUnfilledSeedCopy(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false;
  const text = plainMeta(value, Number.POSITIVE_INFINITY) ?? '';
  return SEED_START.test(text) && SEED_INSTRUCTION.test(text);
}

/** `value` unchanged, or `undefined` when it is seed copy, so every caller's own "no description" fallback runs. */
export function withoutSeedCopy<T>(value: T): T | undefined {
  return isUnfilledSeedCopy(value) ? undefined : value;
}
