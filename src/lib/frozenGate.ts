/**
 * The frozen-account gate: what a visitor sees when a site's owner account is
 * frozen, and the headers that keep that page from ever being stored.
 *
 * WHY THIS IS A SEPARATE, PURE MODULE
 * ───────────────────────────────────
 * Two reasons, and they are the same two that produced `clientFetchCore.ts`.
 *
 * 1. It holds no `next/server` import, so `node --experimental-strip-types
 *    --test` can drive it directly. The header set below is the entire
 *    correctness of this feature (see "WHY MIDDLEWARE" in `middleware.ts`), so
 *    "it is still spelled right" is not good enough.
 * 2. `middleware.ts` runs on EVERY document request of EVERY site in the
 *    fleet. Keeping the markup and the header policy out of it leaves that
 *    file readable as a sequence of guards.
 *
 * WHY THE MARKUP IS SELF-CONTAINED AND INLINE-STYLED
 * ──────────────────────────────────────────────────
 * This response is emitted from middleware, BEFORE the app renders, so it has
 * no access to the app's React tree, its Tailwind bundle, or its layout. It
 * therefore cannot reuse `<QuotaExceeded />`, which is a `'use client'`
 * component styled entirely with Tailwind classes.
 *
 * That is a feature, not a workaround. This is the page a site shows when its
 * data path is deliberately closed; it must not depend on any part of the
 * pipeline that is being gated. Every style is inline and every byte is in the
 * document.
 *
 * The visual design deliberately mirrors `src/components/QuotaExceeded`, so
 * the two paths look like the same product. If you restyle one, restyle both.
 */

/**
 * `Retry-After`, in seconds.
 *
 * One hour. Chosen to match `next.config.ts`'s `expireTime`, which is the
 * outer bound on how long a pre-freeze page can still be sitting in
 * CloudFront: there is no invalidation API for an Amplify-managed
 * distribution, so `s-maxage + stale-while-revalidate` is the real ceiling on
 * how stale the edge can be. Telling a crawler to come back sooner than the
 * edge can even change its answer would just buy pointless re-crawls.
 */
export const FROZEN_RETRY_AFTER_SECONDS = 3600;

/**
 * HTTP status for a frozen site.
 *
 * 503, deliberately, NOT 402 or 404.
 *
 * A freeze is a billing state, and it is usually transient: a card declines,
 * the owner updates it, the site comes back. 503 is the status search engines
 * document as "temporarily unavailable, hold what you have and come back",
 * so a two-day billing problem does not cost the customer their rankings.
 * A 404 invites deindexing. A 402 has no such documented crawler contract,
 * and the CDN treats it worse too: `VR_Client_API`'s
 * `ClientApiDistribution.CustomErrorResponses` pins `ErrorCachingMinTTL: 0`
 * on 400/403/404/405/5xx but has NO 402 entry, so a 402 silently picks up
 * CloudFront's default 10-second error cache.
 */
export const FROZEN_STATUS = 503;

/**
 * Response headers for the frozen page.
 *
 * `Cache-Control: private, no-store` is the single most important line in this
 * feature. The whole reason the gate lives in middleware is that a successful
 * render on an SSG route is, by construction, storable: Next puts it in the
 * page cache and CloudFront pins it for `s-maxage + stale-while-revalidate`.
 * If this page were ever stored, unfreezing would not bring the site back,
 * because there is no purge available for an Amplify-managed distribution.
 * The customer would pay their bill and still be down, with no lever to pull.
 *
 * `no-store` (not merely `no-cache`) is what forbids writing it to disk at
 * all. `private` keeps it out of shared caches. Both are belt and braces: a
 * middleware response is not an ISR entry to begin with.
 */
export const FROZEN_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  'Retry-After': String(FROZEN_RETRY_AFTER_SECONDS),
  // Belt and braces for the two CDNs in front of this app. Amplify's managed
  // CloudFront honours Cache-Control, but these are the vendor-specific
  // opt-outs and they cost nothing.
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  // A frozen site must not be indexed in the state it is in. This is the
  // page-level opt-out only; the site's robots.txt and sitemap.xml keep
  // serving normally on purpose, so a transient billing problem never
  // deindexes the whole site. See `isSkippablePath` in edgeSiteMap.ts.
  'X-Robots-Tag': 'noindex',
});

/**
 * The frozen page.
 *
 * Copy rules (brand/voice.md): no em dashes or en dashes anywhere, and
 * owner-visible language only.
 *
 * Written for the SITE VISITOR, who is the customer's customer, not ours. It
 * deliberately does not say "unpaid", "quota", "suspended" or "billing" in the
 * visitor-facing sentence: a visitor does not need to know the owner's account
 * situation, and telling them is a bad thing to do to the customer. The owner
 * gets a second, quieter line that tells them exactly where to go.
 */
export function renderFrozenPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>This site is temporarily unavailable</title>
</head>
<body style="margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#f9fafb;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<main style="max-width:28rem;text-align:center;">
<div style="margin:0 auto 24px;height:64px;width:64px;border-radius:16px;background:#fef3c7;display:flex;align-items:center;justify-content:center;">
<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
<line x1="12" y1="9" x2="12" y2="13"></line>
<line x1="12" y1="17" x2="12.01" y2="17"></line>
</svg>
</div>
<h1 style="margin:0;font-size:1.5rem;line-height:2rem;font-weight:700;letter-spacing:-0.025em;color:#111827;">This site is temporarily unavailable</h1>
<p style="margin:12px 0 0;font-size:1rem;line-height:1.625;color:#6b7280;">It will be back shortly. Please check again in a little while.</p>
<div style="margin-top:32px;border-radius:12px;border:1px solid #e5e7eb;background:#fff;padding:16px;">
<p style="margin:0;font-size:0.875rem;color:#9ca3af;">If this is your site, sign in to the <a href="https://www.vivreal.io/app" style="font-weight:500;color:#4b5563;text-decoration:underline;">Vivreal portal</a> to bring it back online.</p>
</div>
</main>
</body>
</html>`;
}
