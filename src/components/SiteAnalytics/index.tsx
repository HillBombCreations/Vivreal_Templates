import Script from 'next/script';
import { buildGaInitScript } from '@/lib/gaInitScript';
import type { AdditionalVendorConfig } from '@/lib/vendorTags';

/**
 * Per-site web-analytics tag for a deployed customer site.
 *
 * Reads `siteData.analytics` (carried flat in `siteDetails.values`, surfaced by
 * getSiteData's `...values` spread — no VR_Client_API change). Emits the one
 * tag the configured provider needs, so a MIGRATED site keeps reporting to the
 * customer's OWN existing property ("their analytics move over"), and a
 * portal-connected site starts collecting. Absent/null config ⇒ renders
 * nothing (byte-identical no-op — fleet-safe for every existing site).
 *
 * Uses `next/script` (Next core — no new dependency). Provider ids are
 * validated against a strict per-provider charset before use: the GA4 id is
 * interpolated into an inline init script, so an unvalidated value would be a
 * script-injection vector. A value that fails validation renders nothing
 * (fail-closed) rather than emitting a malformed/unsafe tag.
 */

type AnalyticsProvider = 'google_analytics' | 'plausible' | 'fathom';

export interface SiteAnalyticsConfig {
  provider?: AnalyticsProvider;
  trackingId?: string;
  /**
   * Consent Mode (G13 / change item C3). When true the GA4 init string emits
   * `gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'})`
   * BEFORE `gtag('config',…)` — the ordering that makes the gate real — and
   * reads the `vr_internal` staff-traffic cookie. Absent/false ⇒ the emitted
   * string is BYTE-IDENTICAL to today, which is what keeps this fleet-safe:
   * default-denied reaching a customer site with GA4 configured would silently
   * zero their analytics.
   *
   * C3 owns the DEFAULT half only. The transitions INTO granted — both the
   * banner click and the return-visit restore — belong to the client consent
   * controller (`lib/consent.ts`, C2). Neither half is correct alone.
   *
   * A config flag rather than the isVivrealApex() host gate used elsewhere,
   * because this is a server component in <head>: a `headers()` host read would
   * opt the whole site out of static rendering. See lib/gaInitScript.ts.
   */
  consentMode?: boolean;
  /**
   * Named-vendor tag registry (G14 / change item C9). Declared here because it
   * lives on the same `analytics` config object (which is already in
   * VR_Secure_API's PRESERVE_ON_REPLACE list), but DELIBERATELY IGNORED by this
   * component: <SiteAnalytics> is a server component in <head>, and neither
   * registry vendor has a consent API, so "not loaded" is the only gate that
   * exists for them. They are injected client-side by the consent controller
   * (`lib/consent.ts`) on grant and on restore — see `lib/vendorTags.ts`.
   */
  additional?: AdditionalVendorConfig[];
}

// Strict per-provider id shapes. GA4 = `G-XXXX`; Plausible = a bare domain;
// Fathom = an alphanumeric site id. Anything else is rejected (fail-closed).
const ID_PATTERN: Record<AnalyticsProvider, RegExp> = {
  google_analytics: /^G-[A-Z0-9]+$/i,
  plausible: /^[a-z0-9.-]+$/i,
  fathom: /^[A-Z0-9]+$/i,
};

export default function SiteAnalytics({
  analytics,
}: {
  analytics?: SiteAnalyticsConfig | null;
}) {
  const provider = analytics?.provider;
  const id = analytics?.trackingId?.trim();
  if (!provider || !id) return null;
  const pattern = ID_PATTERN[provider];
  if (!pattern || !pattern.test(id)) return null;

  if (provider === 'google_analytics') {
    return (
      <>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${id}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {buildGaInitScript(id, { consentMode: analytics?.consentMode })}
        </Script>
      </>
    );
  }

  if (provider === 'plausible') {
    return (
      <Script
        defer
        data-domain={id}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    );
  }

  // fathom
  return (
    <Script
      src="https://cdn.usefathom.com/script.js"
      data-site={id}
      defer
      strategy="afterInteractive"
    />
  );
}
