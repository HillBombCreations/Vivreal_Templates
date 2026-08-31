import { NextResponse, NextRequest } from 'next/server'
import { computeBotVerdict, BOT_VERDICT_HEADER } from '@/lib/botVerdict'
import {
  getEdgeSiteMap,
  isSiteFrozen,
  isSkippablePath,
  isLiveContentPath,
  isSelfRedirectLoop,
} from '@/lib/edgeSiteMap'
import { FROZEN_HEADERS, FROZEN_STATUS, renderFrozenPage } from '@/lib/frozenGate'
import { resolveMissingItemRedirect } from '@/lib/redirects'
import {
  PREVIEW_QUERY_PARAM,
  PREVIEW_TOKEN_COOKIE,
  buildPreviewEnableUrl,
  isWellFormedPreviewToken,
} from '@/lib/api/previewToken'

export async function middleware(request: NextRequest) {
  // ISR migration Phase 1 -- upgrade the portal's `?vivreal_preview=<token>`
  // URL into a Next draft-mode session instead of injecting it as a request
  // header.
  //
  // This file used to set `x-vivreal-preview-token` here, which meant
  // lib/api/client.ts had to call `headers()` on EVERY render to find it. That
  // one call forced every route on every customer site dynamic and was the
  // sole blocker on prerender/ISR eligibility for the whole fleet
  // (docs/projects/isr-migration/plan.md, "Root blocker"). Draft mode is
  // readable without making a public render dynamic; a request header is not.
  //
  // The `?vivreal_preview=` contract is deliberately UNCHANGED, so the portal
  // needs no coordinated release: the same link it emits today still starts a
  // preview, it just costs one extra 307 first. `/api/preview/enable` sets the
  // token cookie that client.ts relays to VR_Client_API as `x-vivreal-preview`
  // -- the header that keeps a portal preview off the customer's API quota.
  //
  // Loop safety: the redirect target has the preview param stripped
  // (resolvePreviewRedirectTarget), so the bounced-back request cannot land
  // here again. A malformed token skips the detour entirely and renders as an
  // ordinary public request, which is what it would have degraded to anyway --
  // VR_Client_API would have refused it.
  //
  // GET/HEAD only. A 307 preserves method and body, so redirecting a POST that
  // happened to carry the param would re-post it at /api/preview/enable and
  // earn a 405. Nothing sends the param on a POST today; a POST that somehow
  // did simply renders without the bypass (metered, still correct), which is
  // the better of the two failure modes.
  //
  // NextResponse.redirect with an absolute URL is correct HERE and would not
  // be inside a route handler: Next's middleware adapter rewrites a Location
  // whose host matches the request back to a relative one
  // (next/dist/server/web/adapter.js -> getRelativeURL), so the Amplify
  // localhost:3000 trap that bit .well-known/llms.txt cannot reach this call.
  // /api/preview/enable, being a route handler, emits its Location relative by
  // hand for exactly that reason.
  const previewToken = request.nextUrl.searchParams.get(PREVIEW_QUERY_PARAM)
  if (
    (request.method === 'GET' || request.method === 'HEAD') &&
    isWellFormedPreviewToken(previewToken)
  ) {
    return NextResponse.redirect(
      new URL(
        buildPreviewEnableUrl(
          previewToken,
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        ),
        request.nextUrl,
      ),
      307,
    )
  }

  const requestHeaders = new Headers(request.headers)

  // Task 14 item 2 (dashboard-insights-phase-3-capture/plan.md, D7) --
  // compute the visitor bot verdict ONCE, here at the edge, where the
  // inbound request still carries the real user-agent. lib/api/client.ts
  // relays the VERDICT (never the raw UA) on the product read.
  requestHeaders.set(BOT_VERDICT_HEADER, computeBotVerdict(request.headers.get('user-agent')))

  const fallthrough = () => NextResponse.next({ request: { headers: requestHeaders } })

  // Change 1a (docs/bugs/templates-soft-404-and-301-status): resolve authored
  // redirects (siteData.redirects) to a REAL 301 before any page component
  // or Suspense boundary runs. `permanentRedirect()` at the page layer
  // ([slug]/page.tsx:177-179, [slug]/[itemId]/page.tsx:112-114) emits a 308,
  // never a 301 — and even that can be lost entirely to a soft-200 once
  // streaming has started (research.md's root-cause finding). Middleware is
  // the only place in this app that runs before commit, so it's the only
  // place that can guarantee the literal status.
  //
  // Every branch below is a guard that falls through to `fallthrough()` --
  // the exact behaviour this file already had. Nothing here may prevent
  // `NextResponse.next({ request: { headers: requestHeaders } })` from being
  // reachable.

  // isSkippablePath covers both: (a) Studio preview traffic -- must never be
  // redirected by a cached map, and preview reads already bypass every cache
  // layer (src/lib/api/client.ts, clientFetchCached) -- and (b) non-document
  // paths (`/_next/*`, `/api/*`, extension-bearing paths), a cost optimisation
  // only, since these can never be an authored redirect's `from`.
  //
  // The cookie check carries (a) forward. Preview traffic used to be
  // identifiable for the whole session by `?vivreal_preview=` riding on the
  // URL; after the draft-mode swap the param appears on exactly ONE request
  // (the one redirected to /api/preview/enable) and every later request in the
  // session carries the cookie instead. Without this line a preview session
  // would start being redirected by the 300s-stale edge map -- e.g. a page the
  // author just created would 301 away under them -- which is precisely the
  // failure isSkippablePath's preview clause exists to prevent.
  if (request.cookies.has(PREVIEW_TOKEN_COOKIE) || isSkippablePath(request.nextUrl)) {
    return fallthrough()
  }

  const { pathname } = request.nextUrl

  const siteMap = await getEdgeSiteMap()

  // WHY MIDDLEWARE, and why the freeze is enforced HERE and nowhere else.
  //
  // A frozen account used to keep serving its real site indefinitely.
  // Measured at 367 seconds and unbounded in principle, because THREE
  // independent stale-on-error layers each keep the last good answer:
  //
  //   1. `unstable_cache` (clientFetchCached) keeps the last good siteDetails
  //      when its background revalidation throws, so getSiteData() never even
  //      observes the freeze.
  //   2. Next's response cache re-serves the previous good page whenever a
  //      render fails, so making the render fail just re-serves the real site.
  //   3. CloudFront serves stale, and there is no invalidation API for an
  //      Amplify-managed distribution.
  //
  // No change inside the render can defeat all three: on an SSG route Next
  // 16.3.3 has no uncacheable-200 state at all, so a render that SUCCEEDS with
  // the frozen page is storable (and would then be pinned at the edge for up
  // to an hour AFTER unfreezing, with no purge available), while a render that
  // FAILS is re-served from the previous good entry. Middleware is the only
  // layer above all three, and its response is not an ISR entry, so it is the
  // only place that can answer uncached. See `frozenGate.ts`.
  //
  // Ordering is deliberate. This sits AFTER the preview-cookie and
  // `isSkippablePath` returns above, which is what keeps three things working
  // on a frozen site: the owner's portal preview (so they can still see their
  // own site while sorting billing), `/_next/*` and `/api/*`, and robots.txt
  // and sitemap.xml. That last one is a decision, not an accident: a freeze is
  // usually a declined card that clears in days, and suppressing a site's
  // crawlable surface over it risks deindexing the customer for a transient
  // billing problem.
  //
  // `isSiteFrozen()` is a pure read of a verdict the `getEdgeSiteMap()` call
  // above already refreshed. No extra fetch, no extra latency, and it fails
  // open on every ambiguous state.
  if (isSiteFrozen()) {
    return new NextResponse(renderFrozenPage(), {
      status: FROZEN_STATUS,
      headers: FROZEN_HEADERS,
    })
  }

  if (!siteMap) {
    // Cold-and-in-flight, or the upstream fetch failed (fail-open by design
    // -- see edgeSiteMap.ts). Degrade depends on the page layer's OWN 60s
    // cache: if it is warm, permanentRedirect() emits a 308 to the same
    // target. If the upstream is fully down, the page layer has no map
    // either and the request 404s -- measured in review pass 5. So this is
    // a graceful degrade only while the page-layer cache holds, not
    // unconditionally.
    return fallthrough()
  }

  // NEVER shadow live content. This re-establishes the invariant
  // src/lib/redirects.ts:44-52 documents ("a redirect must never shadow live
  // content") -- middleware runs BEFORE the page layer that normally
  // enforces that ordering, so it has to be re-established explicitly here.
  // This is the single most important line in this file.
  if (isLiveContentPath(pathname, siteMap.slugs)) {
    return fallthrough()
  }

  // Reuse the existing composed resolveMissingItemRedirect() -- the same
  // helper every page-layer call site uses, so all layers share one
  // typeof/same-origin guard and cannot drift (review pass 4, FAIL 1: a bare
  // resolveRedirect() here had no `typeof target === 'string'` guard, so a
  // malformed authored `to` -- e.g. a non-string off an unvalidated envelope
  // cast, edgeSiteMap.ts:216 -- reached isSameOriginRedirectTarget() and
  // threw `target.startsWith is not a function`, a live 500 on every route).
  const target = resolveMissingItemRedirect(siteMap.redirects, pathname)

  if (!target) {
    return fallthrough()
  }

  // No match, or the target resolves back to the same path (loop guard --
  // resolve at most one hop, never follow chains, exactly as the page layer
  // does today).
  if (isSelfRedirectLoop(pathname, target)) {
    return fallthrough()
  }

  const redirectUrl = new URL(target, request.url)

  // AUTHORITATIVE same-origin check (docs/bugs/templates-soft-404-and-301-status,
  // review pass 2, FAIL 1): validate the RESOLVED URL the parser actually
  // produced, not the raw `target` string. The raw-string pre-filter above
  // cannot be made to fully model the WHATWG URL parser's own normalisation
  // (backslash-as-slash for special schemes, TAB/LF/CR stripped from
  // anywhere in the input) -- this check interrogates the SAME parser that
  // will produce the `Location` header, so it cannot be evaded by any input
  // shape. An authored `SiteRedirect.to` is migrator-authored content, not a
  // value this app fully controls end-to-end, so it must be treated as
  // untrusted all the way to the literal redirect emitted below.
  if (redirectUrl.origin !== request.nextUrl.origin) {
    return fallthrough()
  }

  redirectUrl.search = request.nextUrl.search
  return NextResponse.redirect(redirectUrl, 301)
}
