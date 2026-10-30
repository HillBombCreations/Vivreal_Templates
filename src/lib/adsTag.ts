/**
 * A customer site's own Google tags behind the visitor permission banner
 * (owner ideas 2026-10-29, plan 3.3, D18 to D20, T6).
 *
 * WHEN A CUSTOMER SITE ASKS. Connecting a Google tag in the app (Pro) stores
 * `analytics.consentMode: true` (VR_Secure_API forces it), and from then on the
 * site asks its visitors first, in the renderer's words (`CONSENT_COPY`), which
 * the owner saw before saving. The banner promises "Reject, and none of this
 * runs", so on such a site NOTHING Google loads before Accept: the layout drops
 * the head tag and the consent controller injects these scripts on Accept and
 * on the restore of a stored Accept, as on Vivreal's own site.
 *
 * A Google Ads code (`AW-`) is gated even without `consentMode`: an Ads tag is
 * never loaded before a choice, whatever else the stored config says. A code
 * that does not match `^AW-[0-9]{6,12}$` emits nothing at all (it is
 * interpolated into a script, so nothing else passes), and asks nothing.
 *
 * CONVERSIONS. `fireAdsConversion` sends Google an Ads conversion only for a
 * result the owner ticked (`adsConversionEvents`), only with a label, only
 * after an Accept, and never under Global Privacy Control (ad signals stay
 * denied there, `lib/consent.ts`).
 *
 * Pure apart from `window`, so it runs under `node --test` with the DOM harness.
 */
import type { VendorScript } from './consent.ts';
import { isGpcEnabled, readStoredConsentChoice, COOKIE_CONSENT_ACCEPTED } from './consent.ts';
import { GA4_ID_PATTERN, resolveConsentGaScripts } from './gaConsentLoad.ts';
import { COOKIE_CONSENT_KEY, CONSENT_COOKIE_NAME } from './consentKeys.ts';
import type { SiteGoal } from './siteEvents.ts';

export const ADS_TAG_ID_PATTERN = /^AW-[0-9]{6,12}$/;
export const ADS_CONVERSION_LABEL_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;
const GOALS: ReadonlySet<string> = new Set<SiteGoal>(['message', 'booking', 'purchase']);

/** The slice of `siteData.analytics` this reads. */
export interface GoogleTagConfig {
  provider?: string;
  trackingId?: string;
  consentMode?: boolean | null;
  adsTagId?: string | null;
  adsConversionLabel?: string | null;
  adsConversionEvents?: readonly string[] | null;
}

export interface AdsConfig {
  tagId: string;
  /** Absent when no valid label is stored: the tag loads, no conversion is sent. */
  label?: string;
  events: readonly SiteGoal[];
}

/** The site's Ads tag, or null when there is no valid `AW-` code. */
export function readAdsConfig(analytics: GoogleTagConfig | null | undefined): AdsConfig | null {
  const tagId = typeof analytics?.adsTagId === 'string' ? analytics.adsTagId.trim() : '';
  if (!ADS_TAG_ID_PATTERN.test(tagId)) return null;
  const rawLabel = typeof analytics?.adsConversionLabel === 'string' ? analytics.adsConversionLabel.trim() : '';
  const events = Array.isArray(analytics?.adsConversionEvents)
    ? [...new Set(analytics.adsConversionEvents.filter((e): e is SiteGoal => typeof e === 'string' && GOALS.has(e)))]
    : [];
  return {
    tagId,
    ...(ADS_CONVERSION_LABEL_PATTERN.test(rawLabel) ? { label: rawLabel } : {}),
    events,
  };
}

function hasValidGa(analytics: GoogleTagConfig | null | undefined): boolean {
  return analytics?.provider === 'google_analytics' && GA4_ID_PATTERN.test((analytics.trackingId ?? '').trim());
}

/** Which of the renderer's banner sentences a customer site needs. */
export interface CustomerConsentTags {
  analytics: boolean;
  ads: boolean;
}

/**
 * Whether a CUSTOMER site asks its visitors first, and about which tags. Null
 * means it does not ask: no banner, and its head tag renders as before.
 */
export function customerConsentTags(analytics: GoogleTagConfig | null | undefined): CustomerConsentTags | null {
  const ads = readAdsConfig(analytics) !== null;
  const ga = analytics?.consentMode === true && hasValidGa(analytics);
  if (!ads && !ga) return null;
  return { analytics: ga, ads };
}

function adsStandaloneInit(tagId: string): string {
  return [
    'window.dataLayer=window.dataLayer||[];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js',new Date());",
    'var vrGranted=false;',
    `try{vrGranted=window.localStorage.getItem('${COOKIE_CONSENT_KEY}')==='accepted';}catch(e){}`,
    `if(!vrGranted){try{vrGranted=/(^|;[ ]*)${CONSENT_COOKIE_NAME}=accepted(;|$)/.test(document.cookie);}catch(e){}}`,
    'var vrGpc=false;try{vrGpc=navigator.globalPrivacyControl===true;}catch(e){}',
    "var vrA=(vrGranted&&!vrGpc)?'granted':'denied';",
    "gtag('consent','default',{ad_storage:vrA,analytics_storage:vrGranted?'granted':'denied',ad_user_data:vrA,ad_personalization:'denied'});",
    `gtag('config','${tagId}');`,
  ].join('');
}

/**
 * The Google scripts a gated customer site injects on Accept, in order: GA's
 * loader and init when it has GA, then the Ads config. With GA the Ads code
 * rides the same `gtag` (one `config` line); without it the Ads code brings
 * its own loader and init. Empty when there is nothing valid to load.
 */
export function resolveCustomerConsentScripts(analytics: GoogleTagConfig | null | undefined): VendorScript[] {
  const tags = customerConsentTags(analytics);
  if (!tags) return [];
  const scripts: VendorScript[] = tags.analytics ? resolveConsentGaScripts(analytics) : [];
  const ads = readAdsConfig(analytics);
  if (!ads) return scripts;
  if (scripts.length > 0) {
    scripts.push({ domId: 'vr-ads-config', innerHTML: `gtag('config','${ads.tagId}');` });
  } else {
    scripts.push(
      { domId: 'vr-ads-gtag', src: `https://www.googletagmanager.com/gtag/js?id=${ads.tagId}`, innerHTML: '' },
      { domId: 'vr-ads-init', innerHTML: adsStandaloneInit(ads.tagId) },
    );
  }
  return scripts;
}

let conversions: AdsConfig | null = null;

/** Set by <SiteConsent> on a gated customer site; null everywhere else. */
export function configureAdsConversions(next: AdsConfig | null): void {
  conversions = next;
}

/**
 * Send an Ads conversion for a result. Returns whether one was sent (for
 * tests). Never before an Accept, never under GPC, never for an unticked
 * result, never without a label.
 */
export function fireAdsConversion(goal: SiteGoal): boolean {
  if (!conversions?.label || !conversions.events.includes(goal)) return false;
  if (readStoredConsentChoice() !== COOKIE_CONSENT_ACCEPTED || isGpcEnabled()) return false;
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return false;
  try {
    window.gtag('event', 'conversion', { send_to: `${conversions.tagId}/${conversions.label}` });
    return true;
  } catch {
    return false; // a third-party tag must never break the site
  }
}
