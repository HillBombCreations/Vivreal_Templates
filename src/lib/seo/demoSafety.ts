import type { SiteData } from '@/types/SiteData';

/**
 * SEO demo-safety gate.
 *
 * A migrated **demo** site (a pre-cutover outreach deployment on
 * `<name>.vivreal.io`) is a near-duplicate of the prospect's real website. If a
 * search engine indexes it, we create live duplicate-content exposure against
 * the very prospect we're courting. So a demo must be withheld from every index
 * (`noindex` + `robots.txt Disallow: /` + no sitemap) and point its canonical at
 * the prospect's real URL; at cutover the site flips to `live` and becomes
 * fully indexable with its own sitemap + redirects.
 *
 * Signal precedence:
 *   1. `siteData.lifecycleState` — the site doc's flag (flips at cutover with a
 *      revalidate, no rebuild). The primary mechanism.
 *   2. `process.env.SITE_LIFECYCLE` — a build-time fallback so a demo can be
 *      protected even before the flag is written to the doc.
 *
 * **Fail-safe defaults, and they are NOT symmetric:**
 *   - Doc field absent (`undefined`/`null`) on BOTH the doc and the env ⇒ NOT a
 *     demo ⇒ fully indexable. That is deliberate — every existing fleet site
 *     that predates this field must never be accidentally deindexed by this
 *     gate. In that absent case the env fallback still applies.
 *   - Doc field PRESENT but not the literal string `'live'` (including `''`,
 *     `'pending'`, a case variant like `'Demo'`, or anything else) ⇒ demo ⇒
 *     withheld from indexing. `siteDetails.values` is a free-form Mixed Mongo
 *     field written by more than one caller (see
 *     `docs/projects/canonical-emission-review.md` BLOCK 1) — an ambiguous or
 *     malformed value there is typo/empty-write territory, not a signed
 *     assertion that the site is live, so it must fail SAFE TOWARD demo
 *     (withheld) rather than toward indexable. Only an affirmative `'live'`
 *     opts a site into full indexing once the field is present at all.
 */
export const isDemoSite = (
  siteData?: Pick<SiteData, 'lifecycleState'> | null,
): boolean => {
  const docState = siteData?.lifecycleState;
  if (docState === undefined || docState === null) {
    // No doc signal at all — fall back to the build-time env flag, same as
    // before. This is the ONLY path that can return "not a demo" without an
    // affirmative 'live', preserving the existing-fleet fail-safe default.
    return process.env.SITE_LIFECYCLE === 'demo';
  }
  return docState !== 'live';
};

/**
 * The prospect's original URL for a demo site's `<link rel="canonical">`, from
 * the site doc's `sourceUrl` (carried from the migration source) or the
 * `SITE_SOURCE_URL` env fallback. Returns `''` when unknown — callers must skip
 * the canonical entirely in that case (the `noindex` still protects the
 * prospect). Only meaningful for a demo site; callers gate on {@link isDemoSite}.
 */
export const getDemoSourceUrl = (
  siteData?: Pick<SiteData, 'sourceUrl'> | null,
): string => siteData?.sourceUrl ?? process.env.SITE_SOURCE_URL ?? '';
