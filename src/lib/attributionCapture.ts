/**
 * Site-gated entry point for `vr_attr` attribution capture (G12 / change item C1).
 *
 * `attribution.ts` is a VERBATIM copy of the canonical snippet shared with the
 * portal, the landing app and the docs app. It must not be edited here, so the
 * fleet gate lives in this thin wrapper instead. Every Templates caller goes
 * through `runAttributionCapture()`; nothing calls `captureAttribution()`
 * directly.
 *
 * ── WHAT GOES WRONG WITHOUT THE GATE, CORRECTED ─────────────────────────
 *
 * This docblock used to say that an unguarded port would make every customer
 * site "set a first-party tracking cookie on the customer's own domain". That
 * named the wrong failure, and it named the milder one. What actually happens
 * on the shape most customer sites are served from is worse.
 *
 * `attribution.ts`'s `writeCookie()` attaches `Domain=.vivreal.io` whenever the
 * host is `vivreal.io` or any subdomain of it. A customer with no purchased
 * domain IS a subdomain of it: `windward-house.vivreal.io`. So the cookie
 * written on a customer's site is not scoped to that customer at all. It is
 * APEX SCOPED, one shared `vr_attr` across vivreal.io, help.vivreal.io, the
 * portal and every other customer site on a vivreal.io subdomain.
 *
 * That corrupts attribution rather than merely overreaching. A stranger's first
 * ever touch on a customer's page writes `first`, `first` is frozen forever
 * (`captureAttribution` only ever refreshes `last`), and `isInternalHost()`
 * counts every `*.vivreal.io` host as internal, so clicking through to
 * vivreal.io afterwards is not a "meaningful signal" and never refreshes it
 * either. The portal replays the cookie verbatim at signup
 * (`lib/api/register`), and the persisted shape in VR_Main_API
 * (`buildLeadAttribution.js`) has no host, origin or site field and drops
 * unknown keys. So that signup is recorded as a vivreal.io first touch, with a
 * customer's path and a `direct` source, and nothing downstream can tell.
 *
 * A customer on a purchased domain gets the milder failure the old text
 * described: a host-scoped cookie on their own domain. Both are prevented by
 * the same gate, which is why the gate is the fix rather than the cookie
 * scoping.
 *
 * ── THE GATE IS THE SITE ID, NOT THE HOST ───────────────────────────────
 *
 * `vivrealOwnSite` is resolved once in the server layout from
 * `process.env.SITE_ID` and passed down. It is REQUIRED rather than defaulted,
 * so a caller that forgets it is a type error instead of a silent fail-open.
 * See `lib/vivrealApex.ts` for why a hostname could never do this job.
 *
 * This module is deliberately React-free so it can be unit-tested against a DOM
 * harness under `node --test`; <AttributionCapture> is a null-rendering shell.
 */

import { captureAttribution } from './attribution.ts';

export interface AttributionCaptureOptions {
  /**
   * Is this deployment one of Vivreal's own sites? Resolved on the server by
   * `isVivrealOwnSite(process.env.SITE_ID)`. False on every customer site, and
   * false whenever `SITE_ID` is unset or unrecognised.
   */
  vivrealOwnSite: boolean;
  /**
   * True only when the visitor has AFFIRMATIVELY REJECTED in the consent
   * banner. "Undecided" is deliberately NOT a denial: first touch exists only
   * on the first page load, so gating it on a decision the visitor has not made
   * yet destroys it permanently (design Open Question 5, today's contract,
   * carried forward unchanged from Vivreal_SSR_Landing's UTMCapture). The
   * asymmetry is deliberate and `/privacy` must describe it: `vr_attr` is
   * first-party and written pre-decision; the third-party vendor tags are not,
   * and never fire pre-decision.
   */
  consentDenied?: boolean;
}

/**
 * Capture attribution, on Vivreal's own sites only. A no-op everywhere else,
 * including on the server. Never throws: `captureAttribution` swallows its own
 * failures, and the gate itself cannot throw.
 */
export function runAttributionCapture(opts: AttributionCaptureOptions): void {
  if (!opts?.vivrealOwnSite) return;
  captureAttribution({ consentDenied: opts.consentDenied });
}
