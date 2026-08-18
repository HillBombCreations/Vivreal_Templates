import { NextResponse, NextRequest } from 'next/server'
import { computeBotVerdict, BOT_VERDICT_HEADER } from '@/lib/botVerdict'
import {
  getEdgeSiteMap,
  isSkippablePath,
  isLiveContentPath,
  isSelfRedirectLoop,
} from '@/lib/edgeSiteMap'
import { resolveMissingItemRedirect } from '@/lib/redirects'

const PREVIEW_QUERY_PARAM = 'vivreal_preview'
const PREVIEW_REQUEST_HEADER = 'x-vivreal-preview-token'

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  // Capture the portal preview-bypass token from the inbound URL and surface
  // it to server components as a request header. server-side fetches in
  // lib/api/client.ts read it via next/headers and relay to VR_Client_API.
  // The portal appends `?vivreal_preview=<token>` to the iframe src and the
  // "Visit Site" link; this is the only point where it crosses from the
  // user's browser into the SSR request context.
  const previewToken = request.nextUrl.searchParams.get(PREVIEW_QUERY_PARAM)
  if (previewToken) {
    requestHeaders.set(PREVIEW_REQUEST_HEADER, previewToken)
  }

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
  // layer (src/lib/api/client.ts:200-206) -- and (b) non-document paths
  // (`/_next/*`, `/api/*`, extension-bearing paths), a cost optimisation
  // only, since these can never be an authored redirect's `from`.
  if (isSkippablePath(request.nextUrl)) {
    return fallthrough()
  }

  const { pathname } = request.nextUrl

  const siteMap = await getEdgeSiteMap()
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
