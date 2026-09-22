'use client';

import { useEffect } from 'react';
import { runAttributionCapture } from '@/lib/attributionCapture';
import { readStoredConsentChoice, COOKIE_CONSENT_REJECTED } from '@/lib/consent';

/**
 * Null-rendering mount for `vr_attr` attribution capture (G12 / C1).
 *
 * Mounted once in the root layout beside <SiteBeacon>. All behaviour lives in
 * `lib/attributionCapture.ts` (the fleet gate) and `lib/attribution.ts` (the
 * canonical, verbatim-ported snippet) so it is unit-testable without a browser;
 * this component is only the React attachment point.
 *
 * FLEET POSTURE, CORRECTED. This block used to say the capture was "a no-op
 * unless the browser is on the vivreal.io apex, so mounting it fleet-wide
 * changes nothing on a customer site". The second half was false. The gate
 * matched every subdomain of vivreal.io, which is how a customer site with no
 * purchased domain is served, so `vr_attr` WAS written there, apex scoped and
 * shared across every such site. Confirmed in a browser on the deployed fleet,
 * 2026-09-22.
 *
 * The gate is now `vivrealOwnSite`, resolved on the server from
 * `process.env.SITE_ID` because a client component cannot read it. Rendering
 * `null` was always true and still is; it was never the part that mattered.
 */
export default function AttributionCapture({
  /**
   * `isVivrealOwnSite(process.env.SITE_ID)` from the root layout. Required, so
   * a mount that forgets it does not compile.
   */
  vivrealOwnSite,
}: {
  vivrealOwnSite: boolean;
}) {
  useEffect(() => {
    // An AFFIRMATIVE rejection blocks the write. "Undecided" deliberately does
    // not: first touch only exists on the first page load, so gating it on a
    // decision the visitor has not made yet destroys it permanently (Open
    // Question 5 — today's contract, carried forward verbatim). `/privacy` must
    // describe the asymmetry: `vr_attr` is first-party and written
    // pre-decision; the third-party vendor tags never fire pre-decision.
    runAttributionCapture({
      vivrealOwnSite,
      consentDenied: readStoredConsentChoice() === COOKIE_CONSENT_REJECTED,
    });
    // `vivrealOwnSite` is resolved on the server and fixed for the page's
    // lifetime, so this effect is a true once-per-load mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
