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
 * WHY A CONFIG FLAG AND NOT THE `isVivrealOwnSite()` FLEET GATE used by
 * C1/C2/C9: this is per-site policy, not "is this Vivreal". A customer who sets
 * `analytics.consentMode` wants GA4 default-denied on THEIR site, and the fleet
 * gate would refuse them. The reason originally recorded here was that
 * <SiteAnalytics> is a SERVER component in <head> and reading the request host
 * via `headers()` would opt the entire site out of static rendering (the trap
 * documented in Vivreal_SSR_Landing/src/app/layout.tsx). That remains true of
 * the host, but the fleet gate reads `process.env.SITE_ID` rather than a host
 * and would cost nothing, so it is no longer the reason. A config flag is
 * server-safe and keeps the emitted bytes provably unchanged for every site
 * that does not set it.
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
 *
 * IMPORTS: `consentKeys.ts` and nothing else. This module is loaded by the
 * server component <SiteAnalytics>, so it must never import the client consent
 * controller (`consent.ts`). A test pins the import list.
 */
import { COOKIE_CONSENT_KEY, CONSENT_COOKIE_NAME } from './consentKeys.ts';

export interface GaInitOptions {
  /**
   * Emit Consent Mode default-denied ahead of `config`, and read the
   * `vr_internal` staff-traffic cookie. Absent/false ⇒ today's exact literal.
   */
  consentMode?: boolean;
  /**
   * Only with `consentMode`. Set the consent default from the visitor's STORED
   * choice instead of a fixed denied default. Vivreal's own site injects the
   * init only after an accept (`gaConsentLoad.ts`), and the init pushes
   * `config` synchronously, before the controller's `consent update` runs.
   * With a fixed denied default, `config`'s automatic page_view went out
   * denied (gcs=G100, a throwaway client id). Customer sites never set this.
   */
  consentFromStoredChoice?: boolean;
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
  const consentDefault = opts.consentFromStoredChoice
    ? storedChoiceConsentDefault()
    : "gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied'});";

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
    consentDefault,
    'var vrInternal=false;',
    'try{vrInternal=/(^|;[ ]*)vr_internal=/.test(document.cookie);}catch(e){vrInternal=false;}',
    `gtag('config','${id}',vrInternal?{traffic_type:'internal'}:{});`,
  ].join('');
}

/**
 * The consent default read from the stored choice, in the init itself so it
 * lands before `config`. Granted only on the exact stored value `'accepted'`
 * (localStorage first, then the `vr_consent` cookie mirror when storage is
 * blocked); anything else, including a read that throws, stays denied.
 * `ad_personalization` is always denied: an accept here does not cover
 * personalised advertising (basic consent mode, owner decision M1).
 *
 * Global Privacy Control keeps `ad_storage` and `ad_user_data` denied even
 * after an accept (owner approved 2026-10-26): GPC opts out of sharing, and a
 * cookie Accept is not a sharing opt-in. `analytics_storage` still follows
 * the accept. The same rule is in the controller's update (`consent.ts`).
 *
 * Same `[ ]*` character class as the vr_internal read, for the same reason.
 */
function storedChoiceConsentDefault(): string {
  return [
    'var vrGranted=false;',
    `try{vrGranted=window.localStorage.getItem('${COOKIE_CONSENT_KEY}')==='accepted';}catch(e){}`,
    `if(!vrGranted){try{vrGranted=/(^|;[ ]*)${CONSENT_COOKIE_NAME}=accepted(;|$)/.test(document.cookie);}catch(e){}}`,
    "var vrS=vrGranted?'granted':'denied';",
    'var vrGpc=false;try{vrGpc=navigator.globalPrivacyControl===true;}catch(e){}',
    "var vrA=(vrGranted&&!vrGpc)?'granted':'denied';",
    "gtag('consent','default',{ad_storage:vrA,analytics_storage:vrS,ad_user_data:vrA,ad_personalization:'denied'});",
  ].join('');
}
