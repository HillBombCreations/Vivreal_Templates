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

import { captureAttribution, type AttributionPage } from './attribution.ts';

export interface AttributionCaptureOptions {
  /**
   * Is this deployment one of Vivreal's own sites? Resolved on the server by
   * `isVivrealOwnSite(process.env.SITE_ID)`. False on every customer site, and
   * false whenever `SITE_ID` is unset or unrecognised.
   */
  vivrealOwnSite: boolean;
  /** True when the visitor has ACCEPTED in the consent banner (stored choice). */
  consented?: boolean;
  /** True when the visitor has REJECTED in the consent banner (stored choice). */
  consentDenied?: boolean;
}

/**
 * CONSENT FIRST (owner decision, 2026-10-12). The banner says cookies are used
 * once the visitor accepts, so `vr_attr` is written only after Accept. This
 * replaces the earlier "undecided still writes" contract (Open Question 5).
 *
 * First touch is still kept: before a choice, the landing page (query,
 * referrer, path, time) is held in `sessionStorage` under this key, which is
 * not a cookie, never leaves the browser and ends with the tab. Accept writes
 * `vr_attr` from it; Reject drops it. Only the FIRST undecided page is held.
 */
export const PENDING_ATTRIBUTION_KEY = 'vr_attr_pending';
/** The cookie `attribution.ts` writes (its name is not exported there). */
const ATTRIBUTION_COOKIE = 'vr_attr';

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    // Storage can throw in sandboxed or partitioned contexts: hold nothing.
    return null;
  }
}

function readPending(): AttributionPage | undefined {
  try {
    const raw = session()?.getItem(PENDING_ATTRIBUTION_KEY);
    if (!raw) return undefined;
    const page = JSON.parse(raw) as Partial<AttributionPage>; // checked field by field below
    if (typeof page.search !== 'string' || typeof page.referrer !== 'string' || typeof page.pathname !== 'string' || typeof page.at !== 'number') {
      return undefined;
    }
    return { search: page.search, referrer: page.referrer, pathname: page.pathname, at: page.at };
  } catch {
    // A corrupt entry is no entry.
    return undefined;
  }
}

function dropPending(): void {
  try {
    session()?.removeItem(PENDING_ATTRIBUTION_KEY);
  } catch {
    // Nothing held is the state we want anyway.
  }
}

function holdLandingPage(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const store = session();
  if (!store || store.getItem(PENDING_ATTRIBUTION_KEY)) return;
  const page: AttributionPage = {
    search: window.location.search,
    referrer: document.referrer,
    pathname: window.location.pathname,
    at: Date.now(),
  };
  try {
    store.setItem(PENDING_ATTRIBUTION_KEY, JSON.stringify(page));
  } catch {
    // Quota or a disabled store: the first touch is lost, nothing is written.
  }
}

/**
 * Page-load capture, on Vivreal's own sites only. A no-op everywhere else,
 * including on the server. Never throws.
 *  - accepted: write or refresh `vr_attr` from this page, as before;
 *  - rejected: write nothing, and drop any held landing page;
 *  - undecided: write nothing; hold the landing page for an Accept.
 */
export function runAttributionCapture(opts: AttributionCaptureOptions): void {
  if (!opts?.vivrealOwnSite) return;
  if (opts.consentDenied) {
    dropPending();
    return;
  }
  if (opts.consented) {
    captureAttribution();
    return;
  }
  holdLandingPage();
}

/**
 * Banner Accept: write `vr_attr` from the held landing page (its first touch),
 * then from the current page (a later page with its own campaign signal
 * refreshes `last`, as on any accepted visit). GPC still blocks it outright.
 */
export function acceptAttribution(vivrealOwnSite: boolean): void {
  if (!vivrealOwnSite) return;
  const landing = readPending();
  dropPending();
  if (landing) captureAttribution({ page: landing });
  captureAttribution();
}

/** Banner Reject: drop the held landing page. Nothing was written. */
export function rejectAttribution(vivrealOwnSite: boolean): void {
  if (!vivrealOwnSite) return;
  dropPending();
}

/**
 * Withdrawal under Cookie settings: delete `vr_attr` (both the apex-scoped
 * cookie `attribution.ts` writes on vivreal.io and a host-only one) and any
 * held landing page.
 */
export function withdrawAttribution(vivrealOwnSite: boolean): void {
  if (!vivrealOwnSite) return;
  dropPending();
  if (typeof document === 'undefined') return;
  const expired = `${ATTRIBUTION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  document.cookie = expired;
  const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  if (host === 'vivreal.io' || host.endsWith('.vivreal.io')) document.cookie = `${expired}; Domain=.vivreal.io`;
}
