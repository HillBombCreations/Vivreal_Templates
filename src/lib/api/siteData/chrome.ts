import type { SiteData } from '@/types/SiteData';

/**
 * The ONE place site chrome is resolved, and the reason it can only come from
 * one home.
 *
 * ## The bug this module exists to close
 *
 * A site document carries every chrome subsystem TWICE: at the top level
 * (`site.announcement`, what VR_Secure_API's updateSiteValues writes) and in a
 * legacy nested mirror at `siteDetails.values.announcement`, which is what a
 * MIGRATED site is seeded with. Secure writes only the top level and merely
 * PRESERVES the mirror on replace, so the mirror is stale the moment an owner
 * edits anything in Studio.
 *
 * `getSiteData()` builds its result by spreading `...raw.siteDetails.values`
 * (see ./originSource.ts — that spread carries theme tokens, fonts, redirects
 * and lifecycleState, which have no other home, so it stays). Every chrome
 * field therefore arrived from the STALE mirror unless something later in the
 * literal overrode it. Five fields had an override, four had none, and the
 * upstream only ever emitted one of them top-level. Net effect on a live site:
 * an owner edited the announcement bar, saw "saved", and the published site
 * never changed. Not slowly — never. Measured still absent from the origin 71
 * minutes after the save, on cache-busted requests the origin itself answered.
 *
 * ## Why top-level ONLY, with no nested fallback
 *
 * A `raw.X ?? values.X` dual read looks safer and is worse. It keeps two
 * sources of truth alive, so every future chrome field has to be remembered in
 * three repositories or it breaks this same silent way, and it lets a stale
 * mirror win on exactly the sites that have been edited most. The mirror is
 * being retired: the estate is backfilled nested-to-top-level, VR_Client_API
 * emits each field from its top-level home, and this module reads that home
 * and nothing else. A field that is unset at the top level reads as unset, so
 * a gap shows up as a missing strip and gets fixed in the data, rather than
 * being papered over with a value the owner last saw months ago.
 *
 * ## Why this is a separate, JSX-free module
 *
 * Same precedent as ./originSource.ts, ./scheduleFeed.ts and
 * ../../seo/rootMetadata.ts: `index.tsx` cannot be imported by
 * `node --experimental-strip-types --test`, so logic that lives in the .tsx is
 * logic no unit test can call. This defect was invisible to the whole suite
 * precisely because every layer was individually correct and the seam between
 * them was untested. See ./chrome.test.ts.
 */

/**
 * Every Studio "Site extras" chrome subsystem, each with a top-level home on
 * the site doc.
 *
 * Mirrors the `updateDoc.<field> =` blocks in VR_Secure_API's
 * `src/createSites/services/updateSiteValues.js` and the
 * `TOP_LEVEL_CHROME_FIELDS` list in VR_Client_API's
 * `src/services/tenant/getSiteDetails.js`. Those three lists are the contract;
 * adding a chrome field means adding it to all three, and
 * `getSiteDetails`'s own contract test plus ./chrome.test.ts are what make an
 * omission fail loudly instead of silently serving a stale value.
 *
 * `navigation` and `footer` are deliberately NOT here. They are top-level
 * chrome too, but they carry signed brand media and are resolved separately in
 * index.tsx; folding them in would mean this module had to know about signing.
 */
export const SITE_CHROME_FIELDS = [
  'emailPopup',
  'announcement',
  'utilityStrip',
  'fulfillmentStrip',
  'utilityDock',
  'edgeDock',
  'footerNewsletter',
  'floatingCta',
  'favicon',
  'motionPreset',
] as const;

export type SiteChromeField = (typeof SITE_CHROME_FIELDS)[number];

/** The chrome slice of `SiteData`, exactly the fields this module owns. */
export type SiteChrome = Pick<SiteData, SiteChromeField>;

/**
 * The raw VR_Client_API `/tenant/siteDetails` shape, narrowed to the chrome
 * fields. Structurally satisfied by the full `SiteDetailsResponse`.
 *
 * Note what is NOT in this type: `siteDetails`. The nested mirror is not part
 * of this function's input, so reading it is not an oversight this module can
 * make — it is a change someone would have to widen the signature to allow.
 */
export type SiteChromeSource = Partial<Pick<SiteData, SiteChromeField>>;

/**
 * Project the chrome fields off the raw response, top-level home only.
 *
 * Absent or null normalises to `undefined` rather than `null`: every consumer
 * gates on truthiness (`siteData.edgeDock && <EdgeDock …>`), and `undefined`
 * is assignable to all ten declared field types without widening the two plain
 * strings (`favicon`, `motionPreset`) to accept null.
 *
 * The returned object always carries all ten keys, present-but-undefined when
 * unset. That is load-bearing: `getSiteData()` spreads this AFTER
 * `...siteDetails.values`, and an explicit key overrides a spread even when
 * its value is `undefined`. A key that were merely omitted here would let the
 * stale mirror through, which is the entire bug.
 */
export function resolveSiteChrome(raw: SiteChromeSource): SiteChrome {
  // Built by iterating the list so a field can never be half-added (declared
  // in the contract but not actually read). The cast is the narrow price of
  // that loop; chrome.test.ts asserts the returned key set is exactly
  // SITE_CHROME_FIELDS, which is what the cast is claiming.
  const chrome: Record<string, unknown> = {};
  for (const field of SITE_CHROME_FIELDS) {
    chrome[field] = raw[field] ?? undefined;
  }
  return chrome as SiteChrome;
}
