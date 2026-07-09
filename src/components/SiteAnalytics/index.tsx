import Script from 'next/script';

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
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
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
