'use client';

import { useEffect } from 'react';
import { runAttributionCapture } from '@/lib/attributionCapture';
import { readStoredConsentChoice, COOKIE_CONSENT_REJECTED } from '@/lib/consent';

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
    // An AFFIRMATIVE rejection blocks the write. "Undecided" deliberately does
    // not: first touch only exists on the first page load, so gating it on a
    // decision the visitor has not made yet destroys it permanently (Open
    // Question 5 — today's contract, carried forward verbatim). `/privacy` must
    // describe the asymmetry: `vr_attr` is first-party and written
    // pre-decision; the third-party vendor tags never fire pre-decision.
    runAttributionCapture({
      consentDenied: readStoredConsentChoice() === COOKIE_CONSENT_REJECTED,
    });
  }, []);

  return null;
}
