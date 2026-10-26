/**
 * Should <SiteBeacon> send this page view? (marketing-measurement T3)
 *
 * The beacon is cookieless and aggregated server-side, so our own traffic can
 * only be kept out of Vivreal's own visit counts by not sending it. On
 * Vivreal's own sites (`vivrealOwnSite`, the server-resolved site id gate) the
 * beacon is NOT sent when:
 *  - the `vr_internal` staff cookie is set (exact name),
 *  - the host is not `vivreal.io` or `help.vivreal.io` (the `next.vivreal.io`
 *    staging host above all),
 *  - the referrer's host is `next.vivreal.io` (a click through from staging).
 *
 * Customer sites are untouched: the only rule that reaches them is the one the
 * beacon always had (a real `SITE_ID`, never `'preview'`).
 *
 * Pure, so it runs under `node --test`.
 */

export const OWN_SITE_HOSTS: readonly string[] = Object.freeze(['vivreal.io', 'help.vivreal.io']);

const STAGING_HOST = 'next.vivreal.io';
const STAFF_COOKIE = /(^|;[ ]*)vr_internal=/;

export interface BeaconPolicyInput {
  /** `process.env.SITE_ID` from the layout. */
  siteId: string;
  /** `isVivrealOwnSite(process.env.SITE_ID)` from the layout. */
  vivrealOwnSite: boolean;
  /** `window.location.hostname`. */
  hostname: string;
  /** `document.referrer`, or `''`. */
  referrer: string;
  /** `document.cookie`, or `''` when it cannot be read. */
  cookie: string;
}

function referrerHost(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null; // a malformed referrer names no host, so it cannot be the staging host
  }
}

export function shouldSendBeacon(input: BeaconPolicyInput): boolean {
  if (!input.siteId || input.siteId === 'preview') return false;
  if (!input.vivrealOwnSite) return true;
  if (!OWN_SITE_HOSTS.includes(input.hostname.toLowerCase())) return false;
  if (referrerHost(input.referrer) === STAGING_HOST) return false;
  if (STAFF_COOKIE.test(input.cookie)) return false;
  return true;
}
