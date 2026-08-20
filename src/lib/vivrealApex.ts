/**
 * The one runtime gate that keeps Vivreal's own instrumentation off every
 * customer site in the fleet.
 *
 * Vivreal_Templates is the FLEET app: one codebase renders vivreal.io and every
 * customer site, and it ships fleet-wide on a single `promote-stable`. The
 * vivreal.io relaunch adds behaviour that is Vivreal's policy and Vivreal's
 * alone — a `vr_attr` first-party tracking cookie, a cookie-consent banner, and
 * Vivreal's own marketing vendor tags. Running any of it on a customer's domain
 * would set a tracking cookie on the customer's site, under the customer's
 * privacy policy, without the customer asking. That is the single
 * highest-consequence failure mode in this workstream, so it is guarded by ONE
 * predicate that every caller shares and that is unit-tested in both directions.
 *
 * Design: docs/projects/vivreal-io-relaunch/DESIGN-G12-G14-INSTRUMENTATION.md
 * (C1 "Why an explicit host gate", C2, C9).
 *
 * NOT usable from a server component: reading the request host in the root
 * layout would opt the whole site out of static rendering (the trap documented
 * in Vivreal_SSR_Landing/src/app/layout.tsx). Every consumer is a client
 * component reading `window.location.hostname` on mount. `SiteAnalytics` — a
 * server component in <head> — uses the `analytics.consentMode` CONFIG flag
 * instead, for exactly this reason.
 */

export const VIVREAL_APEX = 'vivreal.io';

/**
 * True only for the vivreal.io apex and its subdomains (`preview.vivreal.io`,
 * a staging host, …). False for every customer domain.
 *
 * Suffix confusion is the failure that matters here: a naive
 * `hostname.includes('vivreal.io')` or `endsWith('vivreal.io')` would return
 * true for `vivreal.io.evil.com` and for `notvivreal.io`. The apex is matched
 * by exact equality and subdomains by a DOT-anchored suffix, so neither passes.
 */
export function isVivrealApex(hostname?: string | null): boolean {
  if (typeof hostname !== 'string') return false;
  // Normalise: case-insensitive per RFC 1035, and a fully-qualified form may
  // carry a trailing root dot (`vivreal.io.`).
  const host = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!host) return false;
  return host === VIVREAL_APEX || host.endsWith(`.${VIVREAL_APEX}`);
}

/**
 * The browser's current hostname, or `null` on the server / in any environment
 * without a DOM. Callers treat `null` as "not the apex" — fail-closed.
 */
export function currentHostname(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  return window.location.hostname ?? null;
}

/** Convenience: is the CURRENT page on the vivreal.io apex? SSR-safe. */
export function onVivrealApex(): boolean {
  return isVivrealApex(currentHostname());
}
