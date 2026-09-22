/**
 * The one runtime gate that keeps Vivreal's own instrumentation off every
 * customer site in the fleet.
 *
 * ── READ THIS FIRST: THIS MODULE NO LONGER LOOKS AT THE HOSTNAME ─────────
 *
 * It used to, and that was a live defect rather than a style problem. The old
 * predicate was `host === 'vivreal.io' || host.endsWith('.vivreal.io')`, and a
 * customer site with no purchased domain is served from exactly that second
 * shape: `windward-house.vivreal.io` is a real customer, an Amplify app of its
 * own, live today. So the gate returned TRUE on customer sites and every
 * "customer sites are safe" claim in this cluster was false. Measured in a
 * browser on 2026-09-22 against the deployed fleet: the consent banner rendered
 * and `vr_attr` was written on `windward-house.vivreal.io`, and neither
 * happened on `dougs-kitchen.com`, which is the same product with a purchased
 * domain. A hostname cannot tell Vivreal's `next.vivreal.io` apart from a
 * customer's `windward-house.vivreal.io`, so no amount of care with dot
 * anchoring could have fixed it. The gate had to stop being a hostname.
 *
 * ── WHAT IT IS NOW ──────────────────────────────────────────────────────
 *
 * An allowlist of the SITE IDS Vivreal owns. Vivreal_Templates is the FLEET
 * app: one codebase renders vivreal.io, help.vivreal.io and every customer
 * site, and it ships fleet-wide on a single `promote-stable`. What separates
 * those deployments is not their host, it is which site document they render,
 * and `SITE_ID` is injected per Amplify app at deploy time.
 *
 * This is the same gate `lib/domains/publicSearch.ts` already uses to keep the
 * `/domains` page off customer sites, for the same reason, and it reuses that
 * module's `VIVREAL_MARKETING_SITE_ID` rather than keeping a second copy of a
 * production id that could drift.
 *
 * ── WHY `process.env.SITE_ID` IS SAFE IN A SERVER COMPONENT ─────────────
 *
 * An earlier revision of this file objected that a server-side gate would opt
 * the whole site out of static rendering. That objection was about reading the
 * request HOST via `headers()`, and it is correct about that: Next's docs list
 * `headers()` and `cookies()` as Request-time APIs that opt a route into
 * dynamic rendering when used in a layout or page. `process.env` is not one of
 * them. Next's own environment-variables guide shows that reading an env var at
 * REQUEST time requires deliberately calling `connection()` first, which is the
 * proof that a plain `process.env` read is evaluated at build time and stays
 * static. Verified against the Next 16 docs shipped in `node_modules/next/dist/
 * docs/01-app/02-guides/environment-variables.md` before this change relied on
 * it. `layout.tsx` already read `process.env.SITE_ID` for `<SiteBeacon>`, so
 * this costs the render nothing that was not already being spent.
 *
 * `SITE_ID` carries no `NEXT_PUBLIC_` prefix, so it does not exist in the
 * client bundle. The decision is therefore made once on the server and passed
 * down as a resolved boolean. Passing the boolean rather than the id is
 * deliberate twice over: there is exactly one place the allowlist is consulted,
 * and no site id is serialised into the page for a stranger to read.
 *
 * Design: docs/projects/vivreal-io-relaunch/DESIGN-G12-G14-INSTRUMENTATION.md
 * (C1 "Why an explicit host gate", C2, C9). That design named a host gate; this
 * module is the correction to it, not an implementation of it.
 */

import { VIVREAL_MARKETING_SITE_ID } from './domains/publicSearch.ts';

export { VIVREAL_MARKETING_SITE_ID };

/**
 * help.vivreal.io.
 *
 * ESTABLISHED, not invented. Read on 2026-09-22 from the live Amplify app
 * `d3j2nl4ojlmhy7` ("vivreal-help"), whose only domain association is the
 * `help` prefix on `vivreal.io` and whose production branch is `stable`, so it
 * is this repo's code rendering this site id. The same read against the
 * marketing app `d1gukor54gwnrj` returns `VIVREAL_MARKETING_SITE_ID` exactly,
 * which is the control that the method reports the right field. Neither app
 * carries a branch-level `SITE_ID` override, so the app-level value is the one
 * that reaches the build.
 */
export const VIVREAL_HELP_SITE_ID = '6aa1b1a896bf3f53d9beeaea';

/**
 * Every site Vivreal owns in the fleet. Adding a Vivreal property means adding
 * its id here and promoting, which is the same friction `vendorTags.ts` gives
 * adding a vendor, and for the same reason: the alternative is a config field
 * that turns a customer's site into one of ours.
 */
export const VIVREAL_OWN_SITE_IDS: readonly string[] = Object.freeze([
  VIVREAL_MARKETING_SITE_ID,
  VIVREAL_HELP_SITE_ID,
]);

/**
 * Is THIS deployment one of Vivreal's own sites?
 *
 * Exact equality against the allowlist after trimming, matching
 * `servesPublicDomainSearch`. Deliberately NOT a prefix, suffix, substring or
 * case-insensitive match: the defect this module exists to correct was an
 * `endsWith` that matched more than it was believed to, and the analogous
 * mistake on an id is an `includes` that accepts
 * `'<vivreal-id>.evil'`. Anything unrecognised renders the inert state, so an
 * unset or unexpected `SITE_ID` is silence rather than the wrong site's
 * instrumentation.
 *
 * `allowlist` is injected for the tests. In production it is the constant.
 */
export function isVivrealOwnSite(
  siteId?: string | null,
  allowlist: readonly string[] = VIVREAL_OWN_SITE_IDS,
): boolean {
  if (typeof siteId !== 'string') return false;
  const trimmed = siteId.trim();
  if (!trimmed) return false;
  return allowlist.includes(trimmed);
}
