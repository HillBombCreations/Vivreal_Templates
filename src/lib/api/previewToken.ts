/**
 * Portal preview-bypass token: the ONE module that owns the token's names,
 * its shape, and the rule for when it may be read.
 *
 * WHY THE TOKEN EXISTS (do not weaken any of this without reading it):
 * VR_Client_API validates an `x-vivreal-preview` header and, on a valid
 * token, sets `previewBypass = true`, which skips BOTH the quota gate and
 * `trackApiUsage` (`VR_Client_API/src/api/handlers.js`, `handleTenantRoutes`).
 * That is what stops a portal-driven preview from burning the customer's own
 * API quota. Every render path in this app must keep relaying that exact
 * token to VR_Client_API, or a preview costs the customer money.
 *
 * WHY THE READ IS GUARDED (ISR migration, Phase 1):
 * The token used to arrive as a request HEADER injected by middleware, so
 * reading it meant calling `headers()` on EVERY render — which forces every
 * route dynamic and makes the app permanently ineligible for prerender/ISR
 * (docs/projects/isr-migration/plan.md, "Root blocker"). Spike A (PASS,
 * 2026-06-25) validated the replacement: `draftMode()` is prerender-safe, and
 * `cookies()` read ONLY inside `if (isEnabled)` stays prerender-safe too. The
 * public path therefore touches no request API at all; only a preview render
 * (draft mode on) goes dynamic, which it must anyway.
 *
 * Deliberately free of `next/headers`, `next/server` and `server-only`: the
 * accessors are injected, so `previewToken.test.ts` can drive Next's REAL
 * `draftMode()`/`cookies()` inside Next's REAL prerender work store and prove
 * the eligibility property rather than assert it. Same tradeoff, for the same
 * reason, as `src/lib/cacheInvalidation.ts`.
 */

/**
 * Query param the portal appends to a preview URL
 * (`Vivreal_Portal_Mobile/src/lib/api/auth/sites/index.tsx`,
 * `appendPreviewToken`). Kept as the entry contract so the portal needs no
 * change for Phase 1 — middleware upgrades it into draft mode.
 */
export const PREVIEW_QUERY_PARAM = 'vivreal_preview';

/**
 * Cookie that carries the token for the rest of the preview session. Read
 * ONLY when draft mode is enabled (see `resolvePreviewToken`), so it can
 * never make a public render dynamic.
 */
export const PREVIEW_TOKEN_COOKIE = 'vr-preview-token';

/** The header VR_Client_API reads. This exact spelling is the quota bypass. */
export const PREVIEW_FORWARD_HEADER = 'x-vivreal-preview';

/** Route that turns a `?vivreal_preview=` URL into a draft-mode session. */
export const PREVIEW_ENABLE_PATH = '/api/preview/enable';

/** Query params `PREVIEW_ENABLE_PATH` accepts. */
export const PREVIEW_ENABLE_TOKEN_PARAM = 'token';
export const PREVIEW_ENABLE_REDIRECT_PARAM = 'redirect';

/**
 * Cookie lifetime, in seconds. Matches the mint TTL in VR_Secure_API
 * (`src/getGroupInformation/api/controllers/sitePreviewToken.js`, `TTL_MS =
 * 10 * 60 * 1000`) so the cookie cannot outlive the token it carries by more
 * than the few seconds between mint and first use. An expired token is not a
 * correctness problem — `verifyPreviewBypass` simply returns false and the
 * call is metered normally — but leaving a dead token in the browser would
 * keep sending a header that can never do anything.
 */
export const PREVIEW_TOKEN_MAX_AGE_SECONDS = 600;

/**
 * Upper bound on an accepted token. The real token is
 * `base64url(groupID:expires_ms)` + '.' + a 64-char hex HMAC, so ~110 bytes;
 * 512 is generous headroom that still refuses to write an unbounded
 * attacker-supplied value into a Set-Cookie header.
 */
const MAX_PREVIEW_TOKEN_LENGTH = 512;

/**
 * The token's wire shape, exactly as VR_Secure_API mints it
 * (`sitePreviewToken.js`): `base64url(payload) + '.' + hex(HMAC_SHA256)`.
 *
 * This is a STRUCTURAL filter, not a second verifier — this app does not hold
 * `PREVIEW_SECRET` and must never pretend to. It is deliberately no stricter
 * than VR_Client_API's own preconditions in `verifyPreviewBypass`: that
 * function splits on the last '.', requires both halves non-empty, decodes
 * the left half as base64url, and does `Buffer.from(sig, 'hex')` followed by
 * a length compare. Anything this regex rejects would therefore have been
 * rejected there too, so the filter can never turn a working bypass into a
 * metered call. What it buys is that a hostile query string can neither be
 * written verbatim into a cookie (`;`, CR/LF, quotes) nor start a draft-mode
 * session on obvious garbage.
 */
const PREVIEW_TOKEN_SHAPE = /^[A-Za-z0-9_-]+\.[0-9a-f]+$/;

/** True when `raw` could possibly be a valid preview token. */
export function isWellFormedPreviewToken(raw: string | null | undefined): raw is string {
  if (typeof raw !== 'string') return false;
  if (raw.length === 0 || raw.length > MAX_PREVIEW_TOKEN_LENGTH) return false;
  return PREVIEW_TOKEN_SHAPE.test(raw);
}

/** The `isEnabled` half of Next's `draftMode()` result. */
export interface DraftModeLike {
  readonly isEnabled: boolean;
}

/** The `get` half of Next's `cookies()` result. */
export interface CookieStoreLike {
  get(name: string): { value: string } | undefined;
}

/**
 * The Spike-A read. Returns the portal preview token for this render, or
 * `null` on the public path.
 *
 * THE ORDER IS THE WHOLE POINT. `readDraftMode()` first, and `readCookies()`
 * ONLY when draft mode is on:
 *
 *   - Public render: `draftMode()` is prerender-safe, `cookies()` is never
 *     called, so nothing marks the render dynamic and the route stays
 *     prerender/ISR eligible.
 *   - Preview render: draft mode is on, so Next already bypasses any cached
 *     output; reading `cookies()` there costs nothing that was not already
 *     dynamic, and it is what keeps the quota bypass alive.
 *
 * Inverting these two lines silently re-introduces the exact blocker Phase 1
 * removes, and nothing else in the app would fail. `previewToken.test.ts`
 * pins it against Next's real prerender store.
 */
export async function resolvePreviewToken(
  readDraftMode: () => Promise<DraftModeLike>,
  readCookies: () => Promise<CookieStoreLike>,
): Promise<string | null> {
  const { isEnabled } = await readDraftMode();
  if (!isEnabled) return null;

  const value = (await readCookies()).get(PREVIEW_TOKEN_COOKIE)?.value;
  // A draft-mode session whose token cookie has expired is not an error: the
  // render stays uncached and correct, the call is simply metered again.
  return isWellFormedPreviewToken(value) ? value : null;
}

/**
 * Validate the post-enable redirect target down to a site-relative path.
 *
 * `PREVIEW_ENABLE_PATH` takes this straight off an attacker-controllable
 * query string, so it is an open-redirect surface. Two rules, both load
 * bearing:
 *
 * 1. The result is ALWAYS relative. Amplify's SSR compute sees `request.url`
 *    with host `localhost:3000` (proven on every customer site by the
 *    `.well-known/llms.txt` regression, `src/lib/llmsTxtRedirect.ts`), so an
 *    absolute `Location` built from the request is wrong on every tenant. A
 *    relative one is same-origin by construction (RFC 9110 section 10.2.2).
 * 2. The candidate is resolved by the SAME WHATWG parser that will produce
 *    the header, against a throwaway base, and rejected unless it lands back
 *    on that base's origin. That closes the `\`, TAB/LF/CR and
 *    protocol-relative bypasses `src/lib/redirects.ts` documents at length,
 *    because it interrogates the parser rather than modelling it.
 *
 * Anything unusable falls back to `/` — a preview that lands on the home page
 * is a far better failure than one that lands on someone else's site.
 */
export function resolvePreviewRedirectTarget(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  // Reject C0 controls + DEL before the parser can strip them (same closed
  // reject class as isSameOriginRedirectTarget, and the same reason: a raw
  // control byte in a Location value makes Node throw ERR_INVALID_CHAR).
  if (/[\x00-\x1f\x7f]/.test(raw)) return '/';

  const base = 'https://preview.invalid';
  let resolved: URL;
  try {
    resolved = new URL(raw, base);
  } catch {
    return '/';
  }
  if (resolved.origin !== base) return '/';

  // Never carry the preview param through: middleware would see it again and
  // redirect back here forever.
  resolved.searchParams.delete(PREVIEW_QUERY_PARAM);
  const search = resolved.searchParams.toString();
  return `${resolved.pathname}${search ? `?${search}` : ''}${resolved.hash}`;
}

/**
 * Build the site-relative URL that upgrades a legacy `?vivreal_preview=` URL
 * into a draft-mode session. Middleware's only job in the preview path.
 */
export function buildPreviewEnableUrl(token: string, redirectTo: string): string {
  const params = new URLSearchParams();
  params.set(PREVIEW_ENABLE_TOKEN_PARAM, token);
  params.set(PREVIEW_ENABLE_REDIRECT_PARAM, resolvePreviewRedirectTarget(redirectTo));
  return `${PREVIEW_ENABLE_PATH}?${params.toString()}`;
}
