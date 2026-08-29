/**
 * Pure redirect response shape for `.well-known/llms.txt` -> `/llms.txt`
 * (portal-simplification-pass B2.3, review.md TQ-1; hotfix 2026-08-29).
 *
 * Deliberately free of `next/server` (returns a plain `ResponseInit`, not a
 * `NextResponse`) so it runs under plain `node --test` — same tradeoff as
 * `llmsTxtProxy.ts`'s header describes for the content-generation side.
 * `src/app/.well-known/llms.txt/route.ts` imports `next/server` and so
 * cannot be loaded by this runner at all; this is what lets the redirect
 * itself be given genuine behavioural coverage anyway, with the route
 * staying a thin `new NextResponse(null, ...)` call site.
 *
 * THE LOCATION IS SITE-RELATIVE ON PURPOSE. The first version resolved an
 * absolute target against `request.url`, and on every customer site that
 * shipped as `Location: https://localhost:3000/llms.txt` (observed on
 * classichousephx.vivreal.io within minutes of the 2026-08-29 promote):
 * inside Amplify's SSR compute the request URL Next.js hands a route handler
 * carries the compute's own host, not the visitor's. A relative `Location`
 * is same-origin on every tenant by construction (RFC 7231 section 7.1.2)
 * and cannot be poisoned by whatever host sits on the request, so it needs
 * no origin resolution at all. Nothing here reads `request.url`, and the
 * route test pins that it never will again.
 */

/** 301 (permanent), not 302/307/308 — the old path is retired, not a temporary detour. */
export const LLMS_TXT_REDIRECT_STATUS = 301;

/** Exactly the spec location, site-relative, no query string ever carried over. */
export const LLMS_TXT_REDIRECT_LOCATION = '/llms.txt';

/**
 * Bounded, and matching the `max-age=300, s-maxage=300` the old 200 at this
 * path always carried. An uncontrolled 301 is cached heuristically by
 * browsers, which is exactly how the `localhost:3000` target above could
 * have outlived its own fix on any client that saw it.
 */
export const LLMS_TXT_REDIRECT_CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

/**
 * The full response shape the route hands to `new NextResponse(null, init)`.
 * Takes no request at all: the redirect depends on nothing about the caller.
 */
export function llmsTxtRedirectResponseInit(): {
  status: number;
  headers: Record<string, string>;
} {
  return {
    status: LLMS_TXT_REDIRECT_STATUS,
    headers: {
      Location: LLMS_TXT_REDIRECT_LOCATION,
      'Cache-Control': LLMS_TXT_REDIRECT_CACHE_CONTROL,
    },
  };
}
