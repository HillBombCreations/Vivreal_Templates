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
 *   - Doc field truly ABSENT (`undefined` — the key is missing from
 *     `siteDetails.values` entirely) ⇒ NOT a demo ⇒ fully indexable, falling
 *     back to the env flag. That is deliberate — every existing fleet site
 *     that predates this field must never be accidentally deindexed by this
 *     gate.
 *   - Doc field PRESENT — including an explicit `null` — but not the literal
 *     string `'live'` (including `''`, `'pending'`, a case variant like
 *     `'Demo'`, or anything else) ⇒ demo ⇒ withheld from indexing.
 *     `siteDetails.values` is a free-form Mixed Mongo field written by more
 *     than one caller (see `docs/projects/canonical-emission-review.md`
 *     BLOCK 1), and its own replace-semantics (VR_Secure_API's
 *     `PRESERVE_ON_REPLACE`) treat an explicit `null` as a caller's deliberate
 *     CLEAR of the key, distinct from never having written it — so an
 *     explicit `null` gets the SAME fail-safe-toward-demo treatment as any
 *     other ambiguous/malformed present value, not the absent-key default. An
 *     ambiguous or malformed value there is typo/empty-write territory, not a
 *     signed assertion that the site is live, so it must fail SAFE TOWARD
 *     demo (withheld) rather than toward indexable. Only an affirmative
 *     `'live'` opts a site into full indexing once the field is present (in
 *     any form, including `null`) at all.
 */
export const isDemoSite = (
  siteData?: Pick<SiteData, 'lifecycleState' | 'degraded'> | null,
): boolean => {
  // A degraded read is not a demo and not a live site. It is UNKNOWN, and the
  // four surfaces that matter (robots.txt, sitemap.xml, the root metadata, and
  // the 404 verdict) all refuse before they reach this function, so none of
  // them can turn that unknown into a claim. See `../api/siteData/degraded.ts`.
  //
  // This branch exists purely as the net under anything that does NOT refuse:
  // an existing caller this change did not reach, or a future one written
  // without knowing about any of it. For that caller "treat unknown as a demo"
  // is still the right default, because the two failure modes are not
  // symmetric. Withholding a live site from indexing is undone by the next
  // successful read; indexing a demo publishes a near-duplicate of a
  // prospect's own website against them, and nothing undoes that.
  //
  // Deliberately NOT the same answer the refusing surfaces give. They can do
  // better than a conservative default because they can decline to answer at
  // all; a `boolean` return has no such option.
  if (siteData?.degraded === true) return true;

  const docState = siteData?.lifecycleState;
  if (docState === undefined) {
    // The key is truly missing — fall back to the build-time env flag, same
    // as before. This is the ONLY path that can return "not a demo" without
    // an affirmative 'live', preserving the existing-fleet fail-safe default.
    return process.env.SITE_LIFECYCLE === 'demo';
  }
  // Present in any other form — including an explicit `null` — fails safe
  // toward demo. `null !== 'live'` is true, so this covers it without a
  // dedicated branch.
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
