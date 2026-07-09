'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

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
 */

const DEFAULT_ENDPOINT = 'https://collect.vivreal.io/e';

export default function SiteBeacon({ siteId }: { siteId?: string }) {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!siteId || siteId === 'preview') return;
    if (typeof window === 'undefined' || !window.navigator) return;
    const endpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT || DEFAULT_ENDPOINT;
    if (!endpoint) return;

    // One beacon per distinct path per mount lifecycle (guards duplicate fires
    // from effect re-runs that don't change the path).
    const path = pathname || window.location.pathname;
    if (lastSent.current === path) return;
    lastSent.current = path;

    const payload = JSON.stringify({
      s: siteId,
      h: window.location.hostname,
      p: path,
      r: document.referrer || '',
      w: window.screen?.width || 0,
    });

    try {
      const blob = new Blob([payload], { type: 'text/plain' });
      if (typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(endpoint, blob)) {
        return;
      }
    } catch {
      /* fall through to fetch */
    }
    try {
      void fetch(endpoint, {
        method: 'POST',
        body: payload,
        keepalive: true,
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
      });
    } catch {
      /* swallow — analytics must never break the site */
    }
  }, [siteId, pathname]);

  return null;
}
