/**
 * Which site shell a render uses: the live read, else the build-time floor,
 * else nothing (and the caller's `FALLBACK_SITE_DATA`).
 * vivreal-hq docs/bugs/site-first-read-fallback/plan.md, section 5.5, Change 4.
 *
 * WHY IT IS ITS OWN FUNCTION. `getSiteData` (`../siteData/index.tsx`) imports
 * `server-only`, so nothing written inline there can be tested by being
 * CALLED. Until this change the decision was one inline expression,
 * `!raw?.siteDetails?.values`, and its only outcome was the placeholder: a
 * black-and-white page with no nav, no logo and no content (TEMPLATES-5).
 *
 * The validity test is the one `getSiteData` has always used: a read whose
 * `siteDetails.values` is missing is not a site. That catches both triggers
 * the research found: a failed read (`null`) and a read that "succeeded"
 * with no values at all (three of four TEMPLATES-5 events, no fetch logged).
 *
 * Plain module, no `server-only` (T1).
 */

export interface SiteDetailsLike {
  siteDetails?: { values?: object | null } | null;
}

export type SiteDetailsSource = 'live' | 'floor' | 'none';

/** The validity test `getSiteData` and `getSiteMap` apply to a siteDetails read. */
export function hasSiteDetailsValues(raw: SiteDetailsLike | null | undefined): boolean {
  return !!raw?.siteDetails?.values;
}

export function resolveSiteDetailsRaw<T extends SiteDetailsLike>(
  raw: T | null | undefined,
  floor: T | null | undefined,
): { raw: T | null; source: SiteDetailsSource } {
  if (raw && hasSiteDetailsValues(raw)) return { raw, source: 'live' };
  if (floor && hasSiteDetailsValues(floor)) return { raw: floor, source: 'floor' };
  return { raw: null, source: 'none' };
}
