/**
 * The GA4 inline init string emitted by <SiteAnalytics> (G13/G14 — change item
 * C3).
 *
 * Extracted from the component so the two things that matter about it can be
 * unit-tested without a browser or a React renderer:
 *
 *  1. BYTE IDENTITY for every site that does not opt in. <SiteAnalytics> ships
 *     fleet-wide. A site with a GA4 id and no `consentMode` must emit the
 *     literal it emits today, character for character — verified, not asserted.
 *     Shipping default-denied to a customer site with GA4 configured would
 *     silently zero their analytics.
 *  2. ORDERING when it IS opted in. `gtag('consent','default',…)` must execute
 *     BEFORE `gtag('config',…)`. That ordering is the entire mechanism: a
 *     consent default that lands after config does nothing, and "consent-gated
 *     GA4" becomes a claim the policy makes and the code does not honour.
 *
 * WHY A CONFIG FLAG AND NOT THE isVivrealApex() HOST GATE used by C1/C2/C9:
 * <SiteAnalytics> is a SERVER component rendered in <head>. Reading the request
 * host there (via `headers()`) would opt the entire site out of static
 * rendering — the trap documented in Vivreal_SSR_Landing/src/app/layout.tsx. A
 * config flag is server-safe and keeps the emitted bytes provably unchanged for
 * every site that does not set it.
 *
 * WHY `analytics.consentMode` AND NOT A NEW `siteData.consent` OBJECT:
 * `analytics` is already in VR_Secure_API's PRESERVE_ON_REPLACE list. A new
 * top-level values key would have to be added there too, or a Studio "Save All"
 * would erase it — the same defect class as the detailPage.styleVariant
 * erasure.
 *
 * The id is interpolated into an inline script, so callers MUST validate it
 * against the per-provider pattern first (<SiteAnalytics> does; that is the
 * pre-existing fail-closed contract this function inherits rather than
 * relaxes).
 */

export interface GaInitOptions {
  /**
   * Emit Consent Mode default-denied ahead of `config`, and read the
   * `vr_internal` staff-traffic cookie. Absent/false ⇒ today's exact literal.
   */
  consentMode?: boolean;
}

/**
 * The literal shipped fleet-wide today. Kept as its own function so the
 * byte-identity test compares against a single source of truth rather than a
 * copy of the string that could drift alongside the thing it is meant to pin.
 */
function legacyInit(id: string): string {
  return `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
}

export function buildGaInitScript(id: string, opts?: GaInitOptions): string {
  if (!opts?.consentMode) return legacyInit(id);

  // Mirrors Vivreal_SSR_Landing/src/app/layout.tsx's gtag-init, minified:
  //   consent default (denied)  ->  vr_internal read  ->  config
  //
  // `vr_internal` is the staff-traffic flag (U4): a cookie set by hand on a
  // Vivreal device so internal browsing is tagged `traffic_type:'internal'` and
  // can be excluded from reporting. Its read is wrapped in try/catch because
  // `document.cookie` throws in sandboxed/partitioned contexts, and an
  // exception in the init script would take GA4 down with it.
  //
  // The cookie test uses `[ ]*` rather than `\s*` deliberately: this string is
  // built in a JS template literal, where `\s` is an unrecognised escape and
  // collapses to a bare `s` — silently producing the WRONG regex. The upstream
  // snippet uses the same character class for the same reason.
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js',new Date());",
    "gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'});",
    'var vrInternal=false;',
    'try{vrInternal=/(^|;[ ]*)vr_internal=/.test(document.cookie);}catch(e){vrInternal=false;}',
    `gtag('config','${id}',vrInternal?{traffic_type:'internal'}:{});`,
  ].join('');
}
