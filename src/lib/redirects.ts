/**
 * Phase 0 of the two-axis detail-route design
 * (docs/projects/industry-example-site-templates/two-axis-detail-route-design.md
 * §5.1, §7.2 step 10, §8 T0) — the WS3 301 redirect mechanism.
 *
 * `blueprint.redirects` has existed on every migrated blueprint since the WS3
 * page-ledger work (Vivreal_Site_Migrator src/blueprint/ledger.js
 * buildRedirectMap) but was never consumed anywhere — a cutover whose URL
 * shape changed (a flattened deep slug, a renamed page) lost 100% of the old
 * URL's inbound-link / search-index equity to a plain 404. The migrator now
 * persists the map onto `siteData.redirects` (siteDetailsVal, same flat
 * precedent as `utilityStrip`/`edgeDock`); this module is the read side.
 *
 * Pure and dependency-free (no `next/navigation`, no fetch, no `server-only`)
 * so it runs under plain `node --test` — callers wrap the result in
 * `permanentRedirect()`.
 */

export interface SiteRedirect {
  from: string;
  to: string;
  status?: number;
}

/**
 * Normalize a path to the migrator's own comparable form (leading slash, no
 * trailing slash, query/hash stripped) — the exact normal form
 * Vivreal_Site_Migrator's `ledger.js#normalizeRedirectPath` already emits for
 * every `from`/`to` it writes, so a straight string compare here is correct
 * without re-deriving that normalization logic in two repos.
 */
function normalizePath(path: string): string {
  if (typeof path !== 'string' || !path) return '/';
  const base = path.split(/[?#]/)[0].replace(/\/+$/, '');
  const withSlash = base.startsWith('/') ? base : `/${base}`;
  return withSlash === '' ? '/' : withSlash;
}

/**
 * Resolve a 301 target for `path` against the site's authored redirect map.
 *
 * Returns `undefined` when `redirects` is absent/empty (the fleet default —
 * every site with nothing renamed pays only this one length check on the hot
 * 404 path) or when nothing matches. Deliberately exact-match only, no fuzzy
 * normalization beyond `normalizePath` — the design doc (§10) explicitly
 * rejects fuzzy scope/path matching as a way to silently resolve the wrong
 * target.
 *
 * Callers MUST only invoke this once every real page / detail-item lookup
 * has already failed (§7.2 step 10) — a redirect must never shadow live
 * content. That ordering is the caller's responsibility; this function has
 * no notion of "does a page exist," by design (it's the two route files'
 * job, not this shared helper's).
 */
export function resolveRedirect(
  redirects: SiteRedirect[] | null | undefined,
  path: string,
): string | undefined {
  if (!redirects || redirects.length === 0) return undefined;
  const target = normalizePath(path);
  for (const r of redirects) {
    if (r && normalizePath(r.from) === target) return r.to;
  }
  return undefined;
}

/**
 * Cheap PRE-FILTER only — true when `target` is plausibly a same-origin
 * absolute path. Lives here (docs/bugs/templates-soft-404-and-301-status,
 * Change A) rather than in `@/lib/edgeSiteMap` because it is now shared by
 * TWO callers with different capabilities: `middleware.ts` (edge) follows
 * this with an AUTHORITATIVE check against the resolved `URL`'s origin
 * (`redirectUrl.origin === request.nextUrl.origin`, checked against the real
 * request) before emitting a 301; `src/app/[slug]/[itemId]/page.tsx`'s
 * `redirectOrNotFound()` has no request object to resolve an authoritative
 * origin against at the page layer, so THIS predicate is the only guard it
 * has — on failure it falls through to `notFound()` rather than ever handing
 * an unvalidated target to `permanentRedirect()`. Both callers already import
 * this module for `resolveRedirect()`, so co-locating this predicate here
 * keeps every layer that resolves a redirect target reading the SAME guard
 * instead of drifting.
 *
 * This is NOT the authority on same-origin-ness on its own; middleware's
 * resolved-URL check downstream of this is. This predicate exists so
 * `new URL(target, ...)` never throws (a malformed target like `//` or
 * `http://` with no host throws `Invalid URL`) and so the obviously-hostile
 * shapes are rejected before either caller does anything with `target` — it
 * must not be trusted to reject every unsafe target on its own where an
 * authoritative resolved-origin check is available (middleware.ts has one;
 * the page layer does not, which is exactly why this predicate is load-
 * bearing there).
 *
 * Why the raw-string check alone is not enough (review pass 2, FAIL 1): the
 * WHATWG URL parser normalises the input BEFORE parsing, in ways this
 * string predicate cannot model — for special schemes (http/https) it
 * treats `\` as `/` during relative resolution, and it strips TAB/LF/CR
 * from ANYWHERE in the input. So `/\evil.com`, `/\tevil.com`,
 * `/\nevil.com`, and `/\revil.com` all pass a naive `startsWith('/')` check
 * yet resolve to `https://evil.com/` once handed to `new URL()`. Rejecting
 * `\`, TAB, LF, and CR here closes that specific gap and keeps the
 * pre-filter cheap; middleware's resolved-origin check downstream is what
 * actually cannot be evaded, because it interrogates the same parser that
 * produces the `Location` header.
 *
 * Review note N1 (page-layer-unvalidated-redirect-target): rejecting only
 * `\`, TAB, LF, CR left every OTHER C0 control (`\x00`-`\x1F` minus the four
 * already listed, plus `\x7F`) accepted here. Node's HTTP header validation
 * then throws `ERR_INVALID_CHAR` on a raw control byte in a `Location`
 * value — turning what should be a clean 404 into a 500, an availability bug
 * on top of the open-redirect one. Reject every C0 control plus DEL
 * (`[\x00-\x1f\x7f]`) — a small, closed reject class, not a positive
 * allowlist. `\` is still rejected explicitly even though it is printable
 * ASCII, since it is the WHATWG-parser bypass this predicate exists to
 * close.
 *
 * Review pass 4, FAIL 2 (templates-soft-404-and-301-status): a prior version
 * of this guard widened the reject class to a printable-ASCII-only
 * allowlist (`/^[\x20-\x7e]*$/`) on the theory that non-ASCII bytes also
 * risked `ERR_INVALID_CHAR`. Measured on a production build that claim is
 * false: `NextResponse.redirect()` (middleware) and `permanentRedirect()`
 * (page layer) both build the `Location` header by round-tripping the
 * target through `new URL()`, and the WHATWG URL parser percent-encodes
 * non-ASCII characters on the way out — `/café` resolves to
 * `/caf%C3%A9`, `/日本` to `/%E6%97%A5%E6%9C%AC` — so a raw non-ASCII
 * authored `to` never reaches the header as a raw byte and never throws.
 * The allowlist form only ever narrowed working 301s (any authored `to`
 * with a legitimate non-ASCII path segment) to a 404; it added no
 * security, since every hostile payload in the review's 31-payload sweep
 * was already caught by the control-char clause above or by the `\`/`//`/
 * leading-slash clauses below. This predicate must not transform its
 * input — validate-only — so percent-encoding is deliberately NOT done
 * here; the URL parser downstream already does it.
 *
 * An authored `SiteRedirect.to` is migrator-authored content, not a value
 * this app fully controls end-to-end, so it must be treated as untrusted at
 * both call sites. Reviewed in docs/bugs/templates-soft-404-and-301-status
 * (review pass 1, Item 2; review pass 2, FAIL 1; review pass 4, FAIL 2;
 * relocated from `@/lib/edgeSiteMap` for Change A / Open Question 2); reject
 * class widened for control characters in
 * docs/bugs/page-layer-unvalidated-redirect-target (review note N1).
 */
export function isSameOriginRedirectTarget(target: string): boolean {
  return (
    target.startsWith('/') &&
    !target.startsWith('//') &&
    !target.includes('\\') &&
    !/[\x00-\x1f\x7f]/.test(target)
  );
}

/**
 * The full decision table behind `redirectOrNotFound()`
 * (`src/app/[slug]/[itemId]/page.tsx`, docs/bugs/templates-soft-404-and-301-status
 * Change A) — deliberately factored out as a PURE function so it can be unit
 * tested under `node --test` without ever importing `next/navigation`. The
 * route file's `redirectOrNotFound()` is a thin, untested wrapper: it calls
 * this, then either `permanentRedirect(target)` or `notFound()` depending on
 * the result — no branching logic of its own to test.
 *
 * Returns the validated redirect target when an authored redirect resolves
 * for `path` AND its `to` passes `isSameOriginRedirectTarget`; returns
 * `undefined` in every other case (no authored redirect, a non-string `to`,
 * or a hostile `to`) — the caller's signal to fall through to `notFound()`
 * rather than ever handing an unvalidated target to `permanentRedirect()`.
 *
 * `redirects` is typed `SiteRedirect[]` but arrives off an envelope cast
 * with no runtime validation of authored content, so `r.to` can in practice
 * be a non-string (malformed CMS data) — the `typeof` check below is a real
 * guard, not defensive noise; without it a malformed `to` would throw out of
 * the render (`.startsWith` on a non-string) instead of failing safe to
 * `notFound()`. (page-layer-unvalidated-redirect-target DoD.)
 *
 * Callers MUST only invoke this on a MISSING-item path, exactly like
 * `resolveRedirect()` above — an existing item must never reach here, so a
 * redirect can never shadow live content. That ordering is the caller's
 * responsibility (`redirectOrNotFound()` is called only from each format
 * arm's own "item not found" branch); this function has no notion of
 * "does the item exist."
 */
export function resolveMissingItemRedirect(
  redirects: SiteRedirect[] | null | undefined,
  path: string,
): string | undefined {
  const target = resolveRedirect(redirects, path);
  return typeof target === 'string' && isSameOriginRedirectTarget(target)
    ? target
    : undefined;
}
