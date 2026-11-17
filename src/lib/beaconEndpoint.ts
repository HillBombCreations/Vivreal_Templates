/**
 * Where Vivreal's first-party page view beacon sends (`<SiteBeacon>`), and so
 * where its link taps go too (`lib/siteEvents.ts` takes the same address).
 *
 * A module of its own, with no `next/*` and no React, because two places read
 * it: the browser code that sends, and `lib/scriptPolicy.ts`, which names its
 * origin in Vivreal's own sites' `connect-src` (SEC-1 F455) when
 * `next.config.ts` is evaluated. One resolver for both means an override moves
 * the policy with the code, rather than leaving the policy naming an address
 * the browser no longer uses.
 */

export const DEFAULT_BEACON_ENDPOINT = 'https://collect.vivreal.io/e';

/** The override when one is set, else the live collector. */
export function beaconEndpoint(raw: string | undefined = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT): string {
  return raw || DEFAULT_BEACON_ENDPOINT;
}
