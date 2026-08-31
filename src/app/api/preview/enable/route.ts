import { NextRequest, NextResponse } from 'next/server';
import { cookies, draftMode } from 'next/headers';
import {
  PREVIEW_ENABLE_REDIRECT_PARAM,
  PREVIEW_ENABLE_TOKEN_PARAM,
  PREVIEW_TOKEN_COOKIE,
  PREVIEW_TOKEN_MAX_AGE_SECONDS,
  isWellFormedPreviewToken,
  resolvePreviewRedirectTarget,
} from '@/lib/api/previewToken';

// MUST be the Node.js runtime: `draftMode().enable()` writes the
// `__prerender_bypass` cookie through Next's request store, and this route is
// the only place in the app allowed to mutate it (Server Components cannot).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/preview/enable?token=<preview token>&redirect=<site-relative path>
 *
 * Turns the portal's legacy `?vivreal_preview=<token>` URL into a Next draft
 * mode session, then bounces to the page the visitor actually asked for.
 * `middleware.ts` is the only caller today; the portal keeps emitting the URL
 * shape it always did, so no portal change is needed for Phase 1.
 *
 * What the session buys, and why this route exists at all:
 *   - Draft mode is how `src/lib/api/client.ts` now recognises a preview render
 *     WITHOUT calling `headers()` on every public render. That `headers()` call
 *     was the single blocker on prerender/ISR eligibility for the whole fleet
 *     (docs/projects/isr-migration/plan.md, "Root blocker").
 *   - The token cookie is what keeps the customer's API quota intact:
 *     `client.ts` relays it to VR_Client_API as `x-vivreal-preview`, which sets
 *     `previewBypass = true` there and skips BOTH the quota gate and
 *     `trackApiUsage` (`VR_Client_API/src/api/handlers.js`). Draft mode alone
 *     would not do that — the token is the credential, draft mode is only the
 *     switch that says "it is safe to read it."
 *
 * Both cookies are written with the same attributes Next itself uses for
 * `__prerender_bypass` (`next/dist/server/async-storage/draft-mode-provider.js`):
 * httpOnly, `SameSite=None; Secure` outside development. That pairing is
 * deliberate — draft mode was designed for CMS preview inside a third-party
 * iframe, and if a browser refuses one of these cookies it must refuse both,
 * so the app degrades to "public render, metered normally" rather than to
 * "draft mode on but no token", which would be dynamic AND billed.
 *
 * `secure` is skipped in development only, because `SameSite=None; Secure`
 * cookies are dropped over plain http://localhost.
 */
export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get(PREVIEW_ENABLE_TOKEN_PARAM);
  const target = resolvePreviewRedirectTarget(
    request.nextUrl.searchParams.get(PREVIEW_ENABLE_REDIRECT_PARAM),
  );

  if (isWellFormedPreviewToken(rawToken)) {
    (await draftMode()).enable();
    (await cookies()).set({
      name: PREVIEW_TOKEN_COOKIE,
      value: rawToken,
      httpOnly: true,
      sameSite: process.env.NODE_ENV !== 'development' ? 'none' : 'lax',
      secure: process.env.NODE_ENV !== 'development',
      path: '/',
      maxAge: PREVIEW_TOKEN_MAX_AGE_SECONDS,
    });
  }
  // A malformed/absent token is NOT an error: redirect anyway, without a
  // session. The visitor gets the ordinary public page, which is the correct
  // and safe outcome. Failing loudly here would only teach probers which
  // token shapes are interesting.

  // Site-RELATIVE Location, never built from `request.url`. Inside Amplify's
  // SSR compute the URL Next hands a route handler carries the compute's own
  // host (localhost:3000), which is how every customer site briefly 301'd to
  // localhost in the 2026-08-29 `.well-known/llms.txt` regression — see
  // src/lib/llmsTxtRedirect.ts. A relative Location is same-origin on every
  // tenant by construction (RFC 9110 section 10.2.2).
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: target,
      // A preview redirect is per-visitor and carries a Set-Cookie; it must
      // never be stored by a shared cache. `no-store` also stops a browser
      // heuristically caching the 307 and skipping the cookie write on a
      // later preview.
      'Cache-Control': 'no-store',
    },
  });
}
