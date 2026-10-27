/**
 * GA4 `cta_click` on Vivreal's own sites (marketing-measurement T2).
 *
 * One document-level, capture-phase click listener. A click on a link into the
 * app's register or login page sends
 * `gtag('event','cta_click',{cta_destination, cta_intent, cta_location, cta_text, transport_type:'beacon'})`.
 * The funnel page reads "Pressed Start Free" as `cta_intent = 'signup'`.
 *
 * WHY AN INTENT AND NOT JUST THE DESTINATION. The header "Start Free" button
 * points at `/app/login`, so counting by destination would call every sign-up
 * intent from the header a log-in. The intent reads the link text.
 *
 * GATES. Installed only when `vivrealOwnSite` (the server-resolved site id
 * gate, `lib/vivrealApex.ts`): on a customer site `window.gtag` is the
 * CUSTOMER's GA4 property and Vivreal's events must never reach it. Sent only
 * when `window.gtag` exists, and on Vivreal's own site GA loads only after an
 * accept (`lib/gaConsentLoad.ts`), so the event exists for consented visitors
 * only (basic consent mode, owner decision M1).
 *
 * React-free so it runs under `node --test`; <CtaClickTracking> is the mount.
 */

export type CtaDestination = 'register' | 'login';
export type CtaIntent = 'signup' | 'login';
export type CtaLocation = 'header' | 'footer' | 'body';

/** The app lives at vivreal.io/app; help.vivreal.io links to it absolutely. */
const APP_HOST = 'vivreal.io';
const DESTINATION_BY_PATH: Readonly<Record<string, CtaDestination>> = Object.freeze({
  '/app/register': 'register',
  '/app/login': 'login',
});
const CTA_TEXT_MAX = 100;
const SIGNUP_WORDING = /^(start( for)? free|get started( free)?|try( it)? free|sign up( free)?|create (an |your )?account)$/;

/** Link text as a visitor reads it: whitespace runs (markup line breaks) collapsed, trimmed. */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Which app page a link opens, or null when it is not a register or login link into the app. */
export function classifyCta(href: string, pageOrigin: string): CtaDestination | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, pageOrigin);
  } catch {
    return null; // malformed href or origin: not a CTA
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.hostname !== APP_HOST) return null;
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  return DESTINATION_BY_PATH[path] ?? null;
}

/** A register link is always a sign-up; a login link is a sign-up when its text says so. */
export function ctaIntent(destination: CtaDestination, text: string): CtaIntent {
  if (destination === 'register') return 'signup';
  return SIGNUP_WORDING.test(normalizeText(text).toLowerCase()) ? 'signup' : 'login';
}

export function ctaLocation(el: Element): CtaLocation {
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  return 'body';
}

/** Windows already holding the listener, so a second install (StrictMode) cannot double-count. */
const installed = new WeakSet<Window>();

/**
 * Attach the listener. Returns the uninstall; a no-op install returns a no-op.
 * Never calls `preventDefault`: the link navigates exactly as before.
 */
export function installCtaClickTracking(vivrealOwnSite: boolean, win?: Window): () => void {
  const target = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!vivrealOwnSite || !target || installed.has(target)) return () => {};

  const onClick = (event: Event) => {
    try {
      const origin = event.target as Element | null; // click targets are Elements; text nodes never receive the event
      const anchor = origin?.closest?.('a[href]');
      if (!anchor) return;
      const destination = classifyCta(anchor.getAttribute('href') ?? '', target.location.origin);
      if (!destination) return;
      if (typeof target.gtag !== 'function') return;
      const text = normalizeText(anchor.textContent ?? '');
      target.gtag('event', 'cta_click', {
        cta_destination: destination,
        cta_intent: ctaIntent(destination, text),
        cta_location: ctaLocation(anchor),
        cta_text: text.slice(0, CTA_TEXT_MAX),
        transport_type: 'beacon',
      });
    } catch {
      // Measurement must never break a click: the link still navigates, the event is lost.
    }
  };

  target.document.addEventListener('click', onClick, true);
  installed.add(target);
  return () => {
    target.document.removeEventListener('click', onClick, true);
    installed.delete(target);
  };
}
