'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { shouldSendBeacon } from '@/lib/beaconPolicy';
import { browserBeaconTransport, buildPageViewPayload, configureSiteEvents } from '@/lib/siteEvents';

/**
 * Vivreal first-party analytics beacon — cookieless page-view collection for
 * the customer's OWN in-portal traffic dashboard (option C). Distinct from
 * <SiteAnalytics> (which emits the customer's captured Google/Plausible/Fathom
 * tag): this is Vivreal's OWN privacy-first collector.
 *
 * Fires a tiny beacon on first paint AND on client-side route changes (App
 * Router SPA navigations don't re-run the server layout). Cookieless + no
 * storage: the visitor is pseudonymized SERVER-SIDE at ingest (daily-rotating
 * salted IP+UA hash — raw IP is never stored). Fire-and-forget via
 * navigator.sendBeacon (text/plain, so no CORS preflight, survives unload),
 * with a keepalive-fetch fallback. Analytics must NEVER break the site — every
 * failure is swallowed.
 *
 * Gated on a real deployed site: prod Amplify sets SITE_ID to the site's id;
 * local dev/preview uses SITE_ID='preview' → the beacon never fires, so no
 * dev/preview traffic pollutes production data.
 *
 * On Vivreal's OWN sites it is also not sent for staff (`vr_internal`), off the
 * vivreal.io and help.vivreal.io hosts, or from a next.vivreal.io referrer
 * (`lib/beaconPolicy.ts`). Customer sites keep exactly the rule above.
 */

const DEFAULT_ENDPOINT = 'https://collect.vivreal.io/e';

export default function SiteBeacon({
  siteId,
  vivrealOwnSite,
}: {
  siteId?: string;
  /** `isVivrealOwnSite(process.env.SITE_ID)` from the root layout. Required, so a mount that forgets it does not compile. */
  vivrealOwnSite: boolean;
}) {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.navigator) return;
    let cookie = '';
    try {
      cookie = document.cookie;
    } catch {
      // Cookies unreadable (sandboxed frame): no staff flag can be seen, so the view counts.
    }
    if (
      !shouldSendBeacon({
        siteId: siteId ?? '',
        vivrealOwnSite,
        hostname: window.location.hostname,
        referrer: document.referrer || '',
        cookie,
      })
    ) {
      return;
    }
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || DEFAULT_ENDPOINT;
    if (!endpoint) return;
    // Link taps and results (lib/siteEvents.ts) follow this page view's gate:
    // they are configured only once `shouldSendBeacon` said yes.
    configureSiteEvents({ siteId: siteId ?? '', endpoint, transport: browserBeaconTransport });

    // One beacon per distinct path per mount lifecycle (guards duplicate fires
    // from effect re-runs that don't change the path).
    const path = pathname || window.location.pathname;
    if (lastSent.current === path) return;
    lastSent.current = path;

    // Owner ideas 3.3: `a` (a Google ad landing, never the click id) and `u`
    // (campaign tags) ride the page view when the address carried them. The
    // path stays query-free (`pagePath`).
    const payload = JSON.stringify(
      buildPageViewPayload({
        siteId: siteId ?? '',
        hostname: window.location.hostname,
        path,
        referrer: document.referrer || '',
        width: window.screen?.width || 0,
        search: window.location.search || '',
      }),
    );
    browserBeaconTransport(endpoint, payload);
  }, [siteId, vivrealOwnSite, pathname]);

  return null;
}
