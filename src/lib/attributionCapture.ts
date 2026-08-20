/**
 * Apex-gated entry point for `vr_attr` attribution capture (G12 / change item C1).
 *
 * `attribution.ts` is a VERBATIM copy of the canonical snippet shared with the
 * portal, the landing app and the docs app — it must not be edited here, so the
 * fleet gate lives in this thin wrapper instead. Every Templates caller goes
 * through `runAttributionCapture()`; nothing calls `captureAttribution()`
 * directly.
 *
 * Why the wrapper is required (design C1, "Why an explicit host gate"):
 * `attribution.ts`'s own `writeCookie()` only attaches `Domain=.vivreal.io` on
 * the apex — but it still writes a HOST-SCOPED `vr_attr` cookie on any other
 * host. Ported unguarded into the fleet app, every customer site would start
 * setting a first-party tracking cookie on the customer's own domain.
 *
 * This module is deliberately React-free so it can be unit-tested against a DOM
 * harness under `node --test`; <AttributionCapture> is a null-rendering shell.
 */

import { captureAttribution } from './attribution.ts';
import { onVivrealApex } from './vivrealApex.ts';

export interface AttributionCaptureOptions {
  /**
   * True only when the visitor has AFFIRMATIVELY REJECTED in the consent
   * banner. "Undecided" is deliberately NOT a denial: first touch exists only
   * on the first page load, so gating it on a decision the visitor has not made
   * yet destroys it permanently (design Open Question 5 — today's contract,
   * carried forward unchanged from Vivreal_SSR_Landing's UTMCapture). The
   * asymmetry is deliberate and `/privacy` must describe it: `vr_attr` is
   * first-party and written pre-decision; the third-party vendor tags are not,
   * and never fire pre-decision.
   */
  consentDenied?: boolean;
}

/**
 * Capture attribution — on the vivreal.io apex only. A no-op everywhere else,
 * including on the server. Never throws: `captureAttribution` swallows its own
 * failures, and the gate itself cannot throw.
 */
export function runAttributionCapture(opts?: AttributionCaptureOptions): void {
  if (!onVivrealApex()) return;
  captureAttribution({ consentDenied: opts?.consentDenied });
}
