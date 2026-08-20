/**
 * The vivreal.io consent controller (G13 / change item C2).
 *
 * PORTED, not invented: `Vivreal_SSR_Landing/src/components/CookieConsent` +
 * the grant/restore paths in its `Providers` are the reference implementation
 * (defect D3 was fixed there first, deliberately, so this stays a port). What
 * is NEW here and owned by C2: the `isVivrealApex()` fleet gate, the withdrawal
 * control, and vendor dispatch.
 *
 * Four responsibilities, and they are not separable:
 *
 *  1. CAPTURE a choice from the banner.
 *  2. RESTORE it on every subsequent mount. This is a correctness requirement,
 *     not polish. On the live site a returning visitor who accepted previously
 *     gets no banner, so `onAccept` never fires, so GA4 stays in
 *     `analytics_storage:'denied'` forever and no vendor is ever injected.
 *  3. WITHDRAW it. GDPR requires withdrawal to be as easy as giving consent,
 *     and `/privacy` cannot describe a control that does not exist.
 *  4. Be the ONLY injection point for the C9 registry vendors. GA4 has a
 *     consent API and can load denied then upgrade; Clarity has none, so "not
 *     loaded" is the only gate that exists for it.
 *
 * React-free on purpose: Templates' test runner (`node --test` with type
 * stripping) cannot compile JSX, so all behaviour lives here and
 * <SiteConsent> is a rendering shell. See `__testing__/domHarness.ts`.
 *
 * FLEET POSTURE: `resolveConsentState()` returns `gated: false` off the
 * vivreal.io apex and every other entry point short-circuits on it, so this
 * module is behaviourally inert on every customer site.
 *
 * Design: docs/projects/vivreal-io-relaunch/DESIGN-G12-G14-INSTRUMENTATION.md
 */

import { onVivrealApex } from './vivrealApex.ts';

/** Same key the landing app writes, so a visitor's choice survives the swap. */
export const COOKIE_CONSENT_KEY = 'cookie_consent_v1';

/**
 * The ONLY stored value that means "this visitor granted consent". Strict
 * equality against it on every read: a stored 'rejected', an empty string, a
 * legacy value, or anything else another script on this origin wrote to the
 * key is NOT consent and must fall through to the denied default.
 */
export const COOKIE_CONSENT_ACCEPTED = 'accepted';
export const COOKIE_CONSENT_REJECTED = 'rejected';

export type ConsentChoice = typeof COOKIE_CONSENT_ACCEPTED | typeof COOKIE_CONSENT_REJECTED;

/**
 * One third-party tag, already resolved to a hard-coded snippet. The consent
 * controller never sees a URL or a provider name — C9's registry
 * (`lib/vendorTags.ts`) does the validating and hands over an inert
 * `{ domId, innerHTML }` pair. Keeping this type free of provider identity is
 * what stops the controller from becoming a second place vendors can be added.
 */
export interface VendorScript {
  /** Stable DOM id, so a double-apply cannot double-inject. */
  domId: string;
  /** The vendor's snippet body — hard-coded in Templates source, never config. */
  innerHTML: string;
}

export interface ConsentState {
  /** Is this host under Vivreal's consent regime at all? False fleet-wide. */
  gated: boolean;
  /** The stored choice, or null when the visitor has not decided. */
  choice: ConsentChoice | null;
  /** Global Privacy Control — a standing refusal. */
  gpc: boolean;
  /** Show the banner? Only on the apex, and only while undecided. */
  showBanner: boolean;
  /** Show the persistent withdrawal affordance? Only once a choice exists. */
  showWithdraw: boolean;
  /** May the registry vendors run right now? */
  vendorsAllowed: boolean;
}

const DENIED_STATE: ConsentState = {
  gated: false,
  choice: null,
  gpc: false,
  showBanner: false,
  showWithdraw: false,
  vendorsAllowed: false,
};

/**
 * Read the stored choice. Storage can throw outright (Safari private mode,
 * hardened browser settings); we cannot read a prior choice then, so we must
 * not assume one — the visitor stays in the denied default, exactly like a
 * first-time visitor.
 */
export function readStoredConsentChoice(): ConsentChoice | null {
  if (typeof localStorage === 'undefined') return null;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
  if (stored === COOKIE_CONSENT_ACCEPTED) return COOKIE_CONSENT_ACCEPTED;
  if (stored === COOKIE_CONSENT_REJECTED) return COOKIE_CONSENT_REJECTED;
  return null;
}

function writeStoredConsentChoice(choice: ConsentChoice): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, choice);
  } catch {
    /* storage blocked — the in-page effect below still applies for this visit */
  }
}

function clearStoredConsentChoice(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
  } catch {
    /* storage blocked — nothing to clear */
  }
}

/**
 * Global Privacy Control (CCPA/CPRA universal opt-out). `attribution.ts` honours
 * it for the first-party cookie; C2 extends it to the third-party vendors, which
 * are the higher exposure.
 */
export function isGpcEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

/**
 * The whole state machine, as one pure-ish read. Off the apex it returns the
 * inert state and NOTHING downstream renders or fires.
 *
 * Deliberate: GPC does NOT suppress the banner. The design's uniform-posture
 * decision (Open Question 4, closed by 9) is that everyone sees it, and a GPC
 * visitor who actively clicks Accept still gets GA4's `analytics_storage`
 * upgrade — a first-party measurement signal they affirmatively asked for.
 * What GPC categorically suppresses is `vr_attr` (in attribution.ts's own
 * unconditional early return) and every registry VENDOR (`vendorsAllowed`
 * below), which are the person-level and third-party exposures.
 */
export function resolveConsentState(): ConsentState {
  if (!onVivrealApex()) return DENIED_STATE;

  const choice = readStoredConsentChoice();
  const gpc = isGpcEnabled();

  return {
    gated: true,
    choice,
    gpc,
    showBanner: choice === null,
    showWithdraw: choice !== null,
    vendorsAllowed: choice === COOKIE_CONSENT_ACCEPTED && !gpc,
  };
}

/**
 * Idempotence guard for the granted state, mirroring the upstream
 * `consentAppliedRef`. `injectVendorScript` has its own DOM-id guard, but the
 * gtag consent update does not — and React StrictMode invokes mount effects
 * twice in development, so the two paths (click and restore) must not be able
 * to double-apply within one page lifetime.
 */
let consentApplied = false;

/** Reset the per-page-load guard. Used by withdrawal and by the unit tests. */
export function resetConsentApplied(): void {
  consentApplied = false;
}

/**
 * Inject one already-validated vendor snippet. Mirrors the upstream Clarity
 * injector: body set BEFORE insertion, so the inline script executes on append.
 * Guarded on its DOM id so a re-apply is a no-op.
 */
export function injectVendorScript(vendor: VendorScript): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(vendor.domId)) return;
  const script = document.createElement('script');
  script.id = vendor.domId;
  script.type = 'text/javascript';
  script.innerHTML = vendor.innerHTML;
  document.head.appendChild(script);
}

/**
 * The single place consented behaviour is turned on — used by BOTH the banner
 * click and the return-visit restore. If these two ever diverge, D3 is back.
 *
 * No `cookie_consent_accept` event here: that event measures the ACT of
 * choosing, which only happens on the click path. Firing it on every return
 * visit would inflate the accept count.
 */
export function applyConsentedState(vendors: readonly VendorScript[] = []): void {
  if (consentApplied) return;
  consentApplied = true;

  if (typeof window !== 'undefined') {
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
  }

  // GPC is a standing refusal for third parties even when a stored 'accepted'
  // exists — checked HERE rather than by the caller so no future call site can
  // forget it.
  if (isGpcEnabled()) return;
  for (const vendor of vendors) injectVendorScript(vendor);
}

/**
 * Mount-time entry point. Restores a stored acceptance WITHOUT any banner
 * interaction, which is the entire point of C2-AC1 — this function must fail
 * against a click-only implementation.
 */
export function runConsentMount(vendors: readonly VendorScript[] = []): ConsentState {
  const state = resolveConsentState();
  if (!state.gated) return state;
  if (state.choice === COOKIE_CONSENT_ACCEPTED) applyConsentedState(vendors);
  return state;
}

/** Banner "Accept": store, apply, and measure the act of choosing. */
export function grantConsent(vendors: readonly VendorScript[] = []): ConsentState {
  if (!onVivrealApex()) return DENIED_STATE;
  writeStoredConsentChoice(COOKIE_CONSENT_ACCEPTED);
  applyConsentedState(vendors);
  if (typeof window !== 'undefined') {
    window.gtag?.('event', 'cookie_consent_accept', { event_category: 'Privacy' });
  }
  return resolveConsentState();
}

/** Banner "Reject": store the refusal. Nothing is injected, nothing upgrades. */
export function denyConsent(): ConsentState {
  if (!onVivrealApex()) return DENIED_STATE;
  writeStoredConsentChoice(COOKIE_CONSENT_REJECTED);
  if (typeof window !== 'undefined') {
    window.gtag?.('event', 'cookie_consent_reject', { event_category: 'Privacy' });
  }
  return resolveConsentState();
}

/**
 * Withdraw a previously given consent.
 *
 * HONEST LIMITATION, and `/privacy` must state it rather than overclaim: an
 * already-executing third-party script cannot be un-injected from a live page.
 * What withdrawal actually does is record the withdrawal, downgrade GA4's
 * consent signal immediately, stop injecting on every subsequent page load, and
 * reload the current page so the withdrawal takes effect now rather than on the
 * next navigation.
 *
 * @param reload injected for testability; defaults to a real page reload.
 */
export function withdrawConsent(reload?: () => void): ConsentState {
  if (!onVivrealApex()) return DENIED_STATE;
  clearStoredConsentChoice();
  resetConsentApplied();
  if (typeof window !== 'undefined') {
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    window.gtag?.('event', 'cookie_consent_withdraw', { event_category: 'Privacy' });
  }
  const doReload =
    reload ?? (() => (typeof window !== 'undefined' ? window.location.reload() : undefined));
  doReload();
  return resolveConsentState();
}
