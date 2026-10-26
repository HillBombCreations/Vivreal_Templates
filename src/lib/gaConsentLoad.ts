/**
 * Google Analytics on Vivreal's own site loads ONLY after the visitor accepts
 * (owner decision, 2026-10-12). The banner says "If you accept, we turn on
 * Google Analytics ... Reject, and neither runs", and until this change GA's
 * `gtag.js` was rendered in <head> on every page view, before any choice and
 * after a reject (consent-denied, but loaded and sending).
 *
 * On Vivreal's own site the layout no longer renders <SiteAnalytics>. The
 * consent controller (`lib/consent.ts`) injects the two scripts this module
 * resolves, on accept and on the restore of a stored accept, and at no other
 * time. Withdrawing under Cookie settings clears the stored accept and
 * reloads, so the next page view loads no GA.
 *
 * Customer sites are untouched: there is no Vivreal banner there, and their
 * GA tag keeps rendering in <head> exactly as before (`SiteAnalytics`).
 *
 * Pure, no imports beyond types, so it runs under `node --test`.
 */
import type { VendorScript } from './consent.ts';
import { buildGaInitScript } from './gaInitScript.ts';

/** A GA4 measurement id. The id is interpolated into an inline script, so nothing else passes. */
export const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/i;

/** The slice of `siteData.analytics` this reads. */
export interface ConsentGaConfig {
  provider?: string;
  trackingId?: string;
}

/**
 * The GA scripts to inject on consent: the `gtag.js` loader and its init, or
 * none when the site has no valid GA4 id. The init sets the consent default
 * from the STORED choice, before `config` (`consentFromStoredChoice`): this is
 * injected only after an accept, and `config` sends the first page_view
 * synchronously, before the controller's update could run, so a fixed denied
 * default sent every first hit denied. The controller's update still follows
 * as the fallback when storage cannot be read.
 */
export function resolveConsentGaScripts(analytics: ConsentGaConfig | null | undefined): VendorScript[] {
  if (analytics?.provider !== 'google_analytics') return [];
  const id = analytics.trackingId?.trim();
  if (!id || !GA4_ID_PATTERN.test(id)) return [];
  return [
    { domId: 'vr-ga-gtag', src: `https://www.googletagmanager.com/gtag/js?id=${id}`, innerHTML: '' },
    { domId: 'vr-ga-init', innerHTML: buildGaInitScript(id, { consentMode: true, consentFromStoredChoice: true }) },
  ];
}
