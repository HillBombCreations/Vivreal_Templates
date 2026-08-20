'use client';

import { useEffect } from 'react';
import { runAttributionCapture } from '@/lib/attributionCapture';

/**
 * Null-rendering mount for `vr_attr` attribution capture (G12 / C1).
 *
 * Mounted once in the root layout beside <SiteBeacon>. All behaviour lives in
 * `lib/attributionCapture.ts` (apex gate) and `lib/attribution.ts` (the
 * canonical, verbatim-ported snippet) so it is unit-testable without a browser;
 * this component is only the React attachment point.
 *
 * Fleet posture: `runAttributionCapture()` is a no-op unless the browser is on
 * the vivreal.io apex, so mounting it fleet-wide changes nothing on a customer
 * site. Renders `null` — nothing enters the DOM on any host.
 */
export default function AttributionCapture() {
  useEffect(() => {
    runAttributionCapture();
  }, []);

  return null;
}
