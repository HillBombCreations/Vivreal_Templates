/**
 * vr_attr attribution snippet — CANONICAL SOURCE (v2 contract).
 *
 * Two LIVE copies, kept byte-identical as `src/lib/attribution.ts`:
 *   - Vivreal_Templates      (vivreal.io and help.vivreal.io, site-id-gated mount)
 *   - Vivreal_Portal_Mobile  (vivreal.io/app)
 * Vivreal_SSR_Landing and Vivreal_Docs also carry a copy, but neither serves
 * vivreal.io any more, so they are not re-synced.
 *
 * Contract + decisions: docs/designs/signup-attribution-tracking/design.md §13.
 * If you change this file, re-sync both live copies. Bump VERSION only for a
 * change an older reader cannot handle: a bump makes every cookie already in a
 * browser unreadable (`readCookie` drops a wrong version). Additive optional
 * touch keys (gbraid and wbraid, marketing-measurement T4) do NOT bump it.
 *
 * Behaviour:
 *   - First-party cookie `vr_attr` on `Domain=.vivreal.io` (omitted on localhost),
 *     Path=/, Max-Age 90d, SameSite=Lax, Secure on https.
 *   - First touch: written once on the first vivreal.io page hit, never overwritten.
 *   - Last touch: overwritten ONLY when the hit carries a meaningful signal
 *     (any utm_*, gclid/gbraid/wbraid/fbclid, or an external referrer). Internal vivreal.io
 *     navigation never clobbers `last`.
 *   - Honors Global Privacy Control: never writes when GPC is on.
 *   - Optional consent gate: pass { consentDenied: true } to skip writing
 *     (used on properties with a consent-mode signal, e.g. the landing site).
 *   - Optional `page`: build the touch from a page snapshot taken earlier
 *     (Vivreal_Templates holds the landing page until the visitor accepts,
 *     owner decision 2026-10-12). Absent: the current page, as before.
 *     Additive and backward compatible; the other copies need not change.
 */

const COOKIE_NAME = 'vr_attr';
const VERSION = 2;
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60; // 90 days
const APEX_DOMAIN = 'vivreal.io';

const UTM_MAX = 256;
const LONG_MAX = 512; // referrer, landing_path, gclid, gbraid, wbraid, fbclid
const SOURCE_MAX = 64;

export interface AttributionTouch {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  gclid?: string;
  /** Google click id for iOS app-to-web clicks (in place of gclid). */
  gbraid?: string;
  /** Google click id for iOS web-to-app clicks (in place of gclid). */
  wbraid?: string;
  fbclid?: string;
  referrer?: string;
  landing_path?: string;
  source?: string;
  first_seen_at?: number; // epoch ms
}

/** The page a touch is built from: the current page, or one held until consent. */
export interface AttributionPage {
  search: string;
  referrer: string;
  pathname: string;
  /** Epoch ms of the visit. */
  at: number;
}

export interface Attribution {
  v: number;
  first: AttributionTouch;
  last: AttributionTouch;
}

const REFERRER_SOURCE_MAP: Array<[RegExp, string]> = [
  [/(^|\.)google\./i, 'google'],
  [/(^|\.)bing\./i, 'bing'],
  [/(^|\.)duckduckgo\./i, 'duckduckgo'],
  [/(^|\.)linkedin\./i, 'linkedin'],
  [/(^|\.)facebook\./i, 'facebook'],
  [/(^|\.)instagram\./i, 'instagram'],
  [/(^|\.)(twitter|x)\.com$/i, 'x'],
  [/(^|\.)t\.co$/i, 'x'],
  [/(^|\.)reddit\./i, 'reddit'],
  [/(^|\.)youtube\./i, 'youtube'],
  [/(^|\.)tiktok\./i, 'tiktok'],
  [/(^|\.)chatgpt\.com$/i, 'chatgpt'],
  [/(^|\.)perplexity\./i, 'perplexity'],
  [/(^|\.)github\./i, 'github'],
];

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function isInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === APEX_DOMAIN ||
    h.endsWith(`.${APEX_DOMAIN}`) ||
    h === 'localhost' ||
    h === '127.0.0.1'
  );
}

function deriveSource(utmSource: string | undefined, referrerHost: string | null): string {
  if (utmSource) return truncate(utmSource.toLowerCase(), SOURCE_MAX);
  if (!referrerHost) return 'direct';
  for (const [pattern, source] of REFERRER_SOURCE_MAP) {
    if (pattern.test(referrerHost)) return source;
  }
  return 'referral';
}

function readCookie(): Attribution | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)));
    if (parsed && parsed.v === VERSION && parsed.first) return parsed as Attribution;
    return null;
  } catch {
    return null;
  }
}

function writeCookie(attr: Attribution): void {
  if (typeof document === 'undefined') return;
  const host = window.location.hostname.toLowerCase();
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(attr))}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  // Apex-scoped so the cookie survives landing ↔ docs ↔ portal navigation.
  if (host === APEX_DOMAIN || host.endsWith(`.${APEX_DOMAIN}`)) {
    parts.push(`Domain=.${APEX_DOMAIN}`);
  }
  if (window.location.protocol === 'https:') parts.push('Secure');
  document.cookie = parts.join('; ');
}

function buildTouch(page?: AttributionPage): { touch: AttributionTouch; hasSignal: boolean } {
  const params = new URLSearchParams(page ? page.search : window.location.search);
  const touch: AttributionTouch = {};

  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
  let hasUtm = false;
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      touch[key] = truncate(value, UTM_MAX);
      hasUtm = true;
    }
  }

  const gclid = params.get('gclid');
  if (gclid) touch.gclid = truncate(gclid, LONG_MAX);
  const gbraid = params.get('gbraid');
  if (gbraid) touch.gbraid = truncate(gbraid, LONG_MAX);
  const wbraid = params.get('wbraid');
  if (wbraid) touch.wbraid = truncate(wbraid, LONG_MAX);
  const fbclid = params.get('fbclid');
  if (fbclid) touch.fbclid = truncate(fbclid, LONG_MAX);

  let referrerHost: string | null = null;
  let externalReferrer = false;
  const referrer = page ? page.referrer : document.referrer;
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (!isInternalHost(url.hostname)) {
        externalReferrer = true;
        referrerHost = url.hostname;
        touch.referrer = truncate(referrer, LONG_MAX);
      }
    } catch {
      /* unparseable referrer — ignore */
    }
  }

  touch.landing_path = truncate(page ? page.pathname : window.location.pathname, LONG_MAX);
  touch.source = deriveSource(touch.utm_source, referrerHost);
  touch.first_seen_at = page ? page.at : Date.now();

  const hasSignal =
    hasUtm ||
    Boolean(touch.gclid) ||
    Boolean(touch.gbraid) ||
    Boolean(touch.wbraid) ||
    Boolean(touch.fbclid) ||
    externalReferrer;
  return { touch, hasSignal };
}

/**
 * Capture attribution on page entry. Call once per page load from a client
 * component mounted in the root/public layout. Safe to call repeatedly.
 */
export function captureAttribution(opts?: { consentDenied?: boolean; page?: AttributionPage }): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  // Honor Global Privacy Control (CCPA/CPRA universal opt-out).
  if ((navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return;
  if (opts?.consentDenied) return;

  try {
    const existing = readCookie();
    const { touch, hasSignal } = buildTouch(opts?.page);

    if (!existing) {
      writeCookie({ v: VERSION, first: touch, last: touch });
      return;
    }
    // First touch is frozen; refresh last touch only on a meaningful signal.
    if (hasSignal) {
      writeCookie({ v: VERSION, first: existing.first, last: touch });
    }
  } catch {
    /* attribution must never break the page */
  }
}

/** Read the current attribution (e.g. at register submit). Null when absent/invalid. */
export function getAttribution(): Attribution | null {
  return readCookie();
}
