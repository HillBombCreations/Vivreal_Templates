/**
 * Preview never gets the public copy (owner ideas 2026-10-29, plan 3.8, D48,
 * T12).
 *
 * THE PROBLEM. Every site app's edge cache key ignores cookies, and the query
 * string is part of it. Once inner pages are cached like the home page (T10,
 * T11), an owner in a Studio preview (draft mode, a cookie) asking for `/about`
 * could be handed the PUBLIC edge copy of `/about`, and see their saved site
 * instead of their draft. True for `/` already; it would spread to every page.
 *
 * THE GUARD, three layers:
 *  (a) `/api/preview/enable` redirects to its target WITH a nonce query,
 *      `vr_pv=<random>`. A query the public copy never had cannot match it at
 *      the edge; the origin sees draft mode and answers `no-store`, which the
 *      edge does not keep. `vr_pv` is NOT the preview param
 *      (`vivreal_preview`), so middleware's enable loop guard is untouched.
 *  (b) In draft mode, a click on an internal link carries the same nonce, so
 *      moving around a preview stays off the public copy (`previewLinkTarget`,
 *      used by <PreviewLinkNonce>). It navigates with a full load, so no
 *      client router prefetch made before the click can be shown either.
 *  (c) Backstop: enable also sets a readable marker cookie `vr_pv_on=1`; a
 *      draft render carries `<meta name="vr-draft" content="1">`; and a tiny
 *      inline script on every page reloads once with a fresh nonce when the
 *      marker is set but the page lacks the meta (a public copy reached some
 *      other way). One reload only: if the page still is not a draft render
 *      (the draft session ended), the marker is dropped instead.
 *
 * `/api/preview/disable` ends draft mode and clears both cookies.
 * Pure, so `node --test` runs it.
 */

export const PREVIEW_NONCE_PARAM = 'vr_pv';
export const PREVIEW_RELOADED_PARAM = 'vr_pv_r';
export const PREVIEW_MARKER_COOKIE = 'vr_pv_on';
export const DRAFT_META_NAME = 'vr-draft';

const NONCE = /^[a-z0-9]{8,32}$/;

/** 16 lowercase hex characters from the platform's CSPRNG. */
export function newPreviewNonce(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isPreviewNonce(value: unknown): value is string {
  return typeof value === 'string' && NONCE.test(value);
}

/**
 * A site-relative target (already through `resolvePreviewRedirectTarget`)
 * with the nonce set, replacing any earlier one, its hash kept.
 */
export function withPreviewNonce(target: string, nonce: string): string {
  const base = 'https://preview.invalid';
  let url: URL;
  try {
    url = new URL(target, base);
  } catch {
    url = new URL('/', base);
  }
  if (url.origin !== base) url = new URL('/', base);
  url.searchParams.delete(PREVIEW_RELOADED_PARAM);
  url.searchParams.set(PREVIEW_NONCE_PARAM, nonce);
  return `${url.pathname}?${url.searchParams.toString()}${url.hash}`;
}

/**
 * Where a click on `href` should go in draft mode: the same address with the
 * nonce, or null to leave the click alone (another site, `mailto:`, a hash on
 * the same page, the preview API itself, or an `/api/` call).
 */
export function previewLinkTarget(href: string, current: string, nonce: string): string | null {
  let url: URL;
  let here: URL;
  try {
    here = new URL(current);
    url = new URL(href, here);
  } catch {
    return null;
  }
  if (url.origin !== here.origin) return null;
  if (url.pathname.startsWith('/api/')) return null;
  if (url.pathname === here.pathname && url.search === here.search && url.hash) return null;
  if (url.searchParams.get(PREVIEW_NONCE_PARAM) === nonce) return null;
  url.searchParams.set(PREVIEW_NONCE_PARAM, nonce);
  return url.toString();
}

/**
 * The backstop, inlined in <head> on every page. Plain ES5, no dependency, and
 * it does nothing at all unless the readable marker cookie is set, so a
 * visitor who never opened a preview runs one regex test.
 */
export const PREVIEW_BACKSTOP_SCRIPT = [
  '(function(){try{',
  `if(!/(^|;[ ]*)${PREVIEW_MARKER_COOKIE}=1(;|$)/.test(document.cookie))return;`,
  `if(document.querySelector('meta[name="${DRAFT_META_NAME}"]'))return;`,
  'var u=new URL(window.location.href);',
  `if(u.searchParams.get('${PREVIEW_RELOADED_PARAM}')){document.cookie='${PREVIEW_MARKER_COOKIE}=; Path=/; Max-Age=0';return;}`,
  `u.searchParams.set('${PREVIEW_NONCE_PARAM}',Math.random().toString(36).slice(2,12)+'r');`,
  `u.searchParams.set('${PREVIEW_RELOADED_PARAM}','1');`,
  'window.location.replace(u.toString());',
  '}catch(e){}})();',
].join('');
