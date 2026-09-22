/**
 * GA4 conversion events (G14 / change item C5).
 *
 * ONE event, deliberately. The full taxonomy (`cta_click`, `outbound_click`,
 * `scroll_depth`, `section_view`, …) is deferred to C10 because it needs
 * renderer-level hooks. This one ships now because U3's failure mode is
 * DECEPTIVE rather than loud: with the GA4 property carried across the origin
 * swap, pageviews keep flowing and the dashboard looks healthy while every
 * conversion reads zero. Ten lines removes the deception.
 *
 * Three gates, all of which must pass:
 *  1. `window.gtag` exists. No GA4 configured means nothing to send.
 *  2. The consent state is GATED and GRANTED. "Granted" includes the RESTORE
 *     path (C2), not just the banner click.
 *  3. Not already fired for this page load.
 *
 * GATE 2 WAS WRONG, and this is the correction. It used to read "returns
 * `gated: false` off the vivreal.io apex, so this is inert fleet-wide". It was
 * not inert fleet-wide. The apex predicate matched every subdomain of
 * vivreal.io, which is how a customer site with no purchased domain is served,
 * so the consent state WAS gated on customer sites. `window.gtag` there is the
 * CUSTOMER's GA4 property (<SiteAnalytics> emits their own tag), so a visitor
 * who accepted Vivreal's banner on a customer's site fired Vivreal's
 * `generate_lead` into the customer's analytics. The gate is now the site id,
 * passed in as `vivrealOwnSite`, and a customer site with GA4 configured emits
 * exactly what it emits today.
 */

import { resolveConsentState, COOKIE_CONSENT_ACCEPTED } from './consent.ts';

/**
 * Per-page-load dedupe. A visitor who submits the footer newsletter and then
 * the exit-intent popup is ONE lead, and a double-submit of the same form is
 * not two conversions. Mirrors the `firedRef` guard EmailPopup already uses for
 * its own open event.
 */
let leadEventFired = false;

/** Reset the dedupe guard. Unit tests only. */
export function resetLeadEventForTests(): void {
  leadEventFired = false;
}

export interface LeadConversionParams {
  /**
   * Is this deployment one of Vivreal's own sites?
   * `isVivrealOwnSite(process.env.SITE_ID)`, resolved in the server layout.
   *
   * REQUIRED, and it was the hole here. This function reads the Vivreal consent
   * state, and that state used to be gated on the vivreal.io apex, which
   * matched every customer site served from a subdomain of it. `window.gtag` on
   * a customer site is the CUSTOMER's GA4 property (<SiteAnalytics> emits their
   * own tag), so a visitor who accepted Vivreal's banner on a customer's site
   * could fire Vivreal's `generate_lead` into the customer's analytics.
   */
  vivrealOwnSite: boolean;
  /** Which capture surface converted, e.g. 'popup' | 'footer' | 'inline'. */
  method?: string;
}

/**
 * Fire GA4's `generate_lead` on a successful email capture.
 *
 * Never throws: analytics must not be able to break a submit handler that has
 * already succeeded.
 */
export function trackLeadConversion(params: LeadConversionParams): void {
  try {
    if (leadEventFired) return;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

    const consent = resolveConsentState(params.vivrealOwnSite);
    if (!consent.gated || consent.choice !== COOKIE_CONSENT_ACCEPTED) return;

    leadEventFired = true;
    window.gtag('event', 'generate_lead', {
      event_category: 'Lead',
      ...(params.method ? { method: params.method } : {}),
    });
  } catch {
    /* a conversion event must never break a conversion */
  }
}
