/**
 * Pure redirect target for `.well-known/llms.txt` -> `/llms.txt` (portal-
 * simplification-pass B2.3, review.md TQ-1).
 *
 * Deliberately free of `next/server` (returns a plain `URL`, not a
 * `NextResponse`) so it runs under plain `node --test` — same tradeoff as
 * `llmsTxtProxy.ts`'s header describes for the content-generation side.
 * `src/app/.well-known/llms.txt/route.ts` imports `next/server` and so
 * cannot be loaded by this runner at all; this is what lets the redirect
 * TARGET be given genuine behavioural coverage anyway, with the route
 * staying a thin `NextResponse.redirect()` call site.
 */

/** 301 (permanent), not 302/307/308 — the old path is retired, not a temporary detour. */
export const LLMS_TXT_REDIRECT_STATUS = 301;

/**
 * Resolves the redirect target against the INCOMING request's own origin, so
 * a request to `https://acme-comedy.com/.well-known/llms.txt` redirects to
 * `https://acme-comedy.com/llms.txt` on that same tenant site, never a
 * hardcoded host. Any query string or extra path on the request URL is
 * dropped — the target is always exactly `/llms.txt`.
 */
export function llmsTxtRedirectTarget(requestUrl: string): URL {
  return new URL('/llms.txt', requestUrl);
}
