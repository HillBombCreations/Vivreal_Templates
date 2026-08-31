/**
 * Centralized VR_Client_API server-side client.
 *
 * All data fetching from VR_Client_API goes through this module.
 * Automatically unwraps the { success, data, error } response envelope.
 */
import 'server-only';
import { cookies, draftMode, headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { BOT_VERDICT_HEADER } from '../botVerdict';
import { buildFetchFailureCapture } from './errorCapture';
import { ApiError, doClientFetch, isQuotaError, type ClientApiConfig } from './clientFetchCore';
import { resolvePreviewToken } from './previewToken';

export { ApiError, isQuotaError };

const CLIENT_API_URL =
  process.env.NEXT_PUBLIC_CLIENT_API || 'https://client.vivreal.io';

const API_KEY = process.env.API_KEY || '';

/** The one place `API_KEY` is read. Passed into every core fetch. */
const CLIENT_API: ClientApiConfig = { baseUrl: CLIENT_API_URL, apiKey: API_KEY };

/**
 * This deployment's siteId. Used ONLY as a Sentry tag so a fleet-wide upstream
 * failure (one Issue, by fingerprint) can still be filtered down to the sites it
 * actually hit. Never part of a fingerprint - see ./errorCapture.
 */
const SITE_ID = process.env.SITE_ID || '';

/**
 * Per-site cache TTL (seconds) for cached public reads (site chrome + content).
 *
 * Read once from `SITE_CACHE_TTL_SECONDS` with a SAFE default of 60. Default 60
 * keeps this merge fully inert: behaviour is identical to the prior hardcoded
 * 60s chrome cache, and content reads (newly cached) get the same short TTL that
 * stays well under VR_Client_API's 300s signed media-URL TTL — so no cached
 * payload can ever carry an expired CDN link at the default.
 *
 * Enabling the long cache is an ops step (per site, AFTER raising the signed-URL
 * TTL to ~24h in VR_Client_API): set this env to `86400`. With on-demand
 * `revalidateTag` invalidation wired (see /api/revalidate), the time TTL is then
 * only a backstop for missed webhooks + scheduled publish-date go-lives.
 *
 * Invalid/absent/non-positive values fall back to 60 — never crash a render on a
 * bad env value, never silently disable caching.
 */
function readCacheTtlSeconds(): number {
  const raw = process.env.SITE_CACHE_TTL_SECONDS;
  if (!raw) return 60;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 60;
}

/**
 * Resolved per-site cache TTL in seconds. Module-scope const so every cached
 * read in this deployment uses one consistent value (env is fixed per Lambda /
 * Amplify instance for its lifetime).
 */
export const SITE_CACHE_TTL_SECONDS = readCacheTtlSeconds();

/**
 * Pull the portal preview-bypass token (if any) out of the current request
 * scope, so every server-to-server fetch can relay it as `x-vivreal-preview`
 * and VR_Client_API can skip quota tracking for portal-driven previews.
 *
 * ISR migration Phase 1: this used to call `headers()` for a middleware-injected
 * header, which forced EVERY route on EVERY site dynamic and was the single
 * blocker on prerender/ISR eligibility (isr-migration/plan.md, "Root blocker").
 * It now uses the Spike-A pattern — `draftMode()` first, `cookies()` only when
 * draft mode is on — which is prerender-safe on the public path. The decision
 * itself lives in `./previewToken.ts` so it can be tested against Next's real
 * prerender work store; see the ordering note there before touching it.
 *
 * Fails closed to `null` on any throw (e.g. called outside a request scope, as
 * a build-time prerender does): no token means the call is metered normally,
 * which is exactly the right fallback.
 */
async function readPreviewToken(): Promise<string | null> {
  try {
    return await resolvePreviewToken(draftMode, cookies);
  } catch {
    return null;
  }
}

/**
 * Read the edge-computed bot verdict middleware.ts set on this request
 * (Task 14 item 3, dashboard-insights-phase-3-capture/plan.md, D7). Callers
 * thread this onto the product read's outbound headers so VR_Client_API can
 * skip 3.2 capture for a visitor bot signal it otherwise has no way to see
 * (the storefront's read is server-to-server, so the UA VR_Client_API would
 * see there is the Amplify server's own fetch agent, not the browser's).
 *
 * Fails open to `'0'` (not-a-bot): `headers()` throws outside a request scope
 * (e.g. a build-time prerender), and an inability to prove "bot" must never
 * silently drop capture for a real visitor. Absent header (any caller that
 * isn't this middleware, or a not-yet-rebuilt deployment) resolves the same way.
 *
 * NOTE (ISR migration Phase 3): this is the LAST unconditional `headers()` read
 * in the render path, and it is now the thing that decides, PER CUSTOMER SITE,
 * whether a page can be cached. Its only caller is `getProducts()`, reached by
 * product detail and by any page whose Studio config binds a payments-provider
 * integration — including `/` on a site whose home carries a product block.
 *
 * The try/catch does NOT hide that from Next.
 * `throwToInterruptStaticGeneration` sets `prerenderStore.revalidate = 0`
 * BEFORE it throws (`next/dist/server/app-render/dynamic-rendering.js`), so
 * swallowing the `DynamicServerError` still leaves the page marked dynamic.
 * Measured: same commit, same env, only the site's content differs — a home
 * page without a product block builds `○ / 5m`, one with a product block builds
 * `ƒ /`, both exit 0.
 *
 * So owner decision 6 ("keep those routes dynamic") is enforced by Next itself
 * from each site's own data, which is the only place it CAN be enforced: route
 * segment config is per file, and "carries a product block" is per site.
 * Removing this `headers()` read (threading the verdict in as a parameter, or
 * dropping it on cached reads) is what would let those pages cache.
 */
export async function readBotVerdict(): Promise<'0' | '1'> {
  try {
    const h = await headers();
    return h.get(BOT_VERDICT_HEADER) === '1' ? '1' : '0';
  } catch {
    return '0';
  }
}

/**
 * Fetch data from VR_Client_API with auth.
 * Unwraps the { success, data, error } envelope automatically.
 */
export async function clientFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return doClientFetch<T>(CLIENT_API, path, await readPreviewToken(), init);
}

/**
 * Safe version — returns fallback on error instead of throwing.
 * Re-throws ApiError with status 402 (quota exceeded) so the page can render
 * the QuotaExceeded component.
 *
 * NOT the freeze path, despite what this comment said until the 2026-08-31
 * root cause was found. A billing freeze is a 400 carrying `code:
 * 'GroupFrozen'`, never a 402, so `isQuotaError` has never recognised one and
 * this re-throw has never fired for a frozen account. Freezes are handled
 * above the render entirely, by the middleware gate in `src/middleware.ts` and
 * `isSiteFrozen()` in `src/lib/edgeSiteMap.ts`. Anything here that needs to
 * tell a freeze apart should read `err.code`, not `err.status`.
 */
export async function clientFetchSafe<T>(
  path: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    return await clientFetch<T>(path, init);
  } catch (err) {
    // Let 402 (quota, NOT freeze — see the doc comment) bubble up so pages can
    // show the quota page
    if (err instanceof ApiError && err.status === 402) {
      throw err;
    }
    // Capture HERE, at the swallow, not at the caller's fallback branch: this is
    // the last point where the real ApiError (with its .status and its cause)
    // still exists. One line lower it is gone and only the fallback remains,
    // which is precisely why the 2026-08-20 fallback renders reached Sentry as
    // nothing at all. 402 is already excluded - it re-throws above.
    Sentry.captureException(
      err,
      buildFetchFailureCapture({ source: 'clientFetchSafe', path, siteId: SITE_ID })
    );
    console.error(`[clientFetchSafe] returning fallback for ${path}:`, err);
    return fallback;
  }
}

/**
 * Cross-request cached variant for hot, rarely-changing, public reads (e.g. the
 * siteDetails / site-chrome call hit on every page render). Caches the unwrapped
 * result for `revalidateSeconds` via the Next.js Data Cache, so crawler/traffic
 * bursts are served from cache instead of re-hitting VR_Client_API (and Mongo)
 * on every render. Independent of route segment config, so it worked when every
 * content route was `force-dynamic` and it still works now that they carry
 * `revalidate = 300` — it is the DATA cache, one layer under the page cache.
 *
 * Safety:
 * - Preview requests (draft mode on, carrying a per-session token) BYPASS the
 *   cache entirely — they must always be fresh, and request APIs (cookies())
 *   can't be read inside a cache scope.
 * - 402 (quota; a freeze is a 400, see clientFetchSafe) is never cached: it
 *   re-throws so the page re-evaluates quota state on the next request.
 * - Cache key includes `path` (so different siteIds/params are isolated); each
 *   customer site is its own deployment, so entries are effectively per-site.
 * - Callers must keep `revalidateSeconds` UNDER VR_Client_API's 300s signed
 *   media-URL TTL so cached payloads never carry expired CDN links — UNLESS the
 *   payload is media-free (see the cache-invalidation design, signed-URL crux).
 *
 * On-demand invalidation:
 * - Pass `tags` (e.g. `['site:<id>']`, `['collection:<id>']`) to make the entry
 *   invalidatable via `revalidateTag(tag, HARD_INVALIDATION)` from the
 *   `/api/revalidate` route handler when the owning content is edited in the
 *   portal. The time `revalidateSeconds` then acts purely as a backstop for
 *   missed webhooks.
 * - Tags are additive and backward-compatible; omit for time-only caching.
 */
export async function clientFetchCached<T>(
  path: string,
  fallback: T,
  revalidateSeconds: number,
  init?: RequestInit,
  tags?: string[]
): Promise<T> {
  const previewToken = await readPreviewToken();
  if (previewToken) {
    // Never cache preview traffic.
    return clientFetchSafe<T>(path, fallback, init);
  }

  const cached = unstable_cache(
    async () => doClientFetch<T>(CLIENT_API, path, null, init),
    ['vr-client-api', path],
    { revalidate: revalidateSeconds, ...(tags && tags.length ? { tags } : {}) }
  );

  try {
    return await cached();
  } catch (err) {
    // Let 402 (quota, NOT freeze) bubble up so pages can show the quota page; never cache it.
    if (err instanceof ApiError && err.status === 402) {
      throw err;
    }
    // Same reasoning as clientFetchSafe above - capture at the swallow, while
    // the ApiError is still intact. 402 re-throws above and is never captured.
    Sentry.captureException(
      err,
      buildFetchFailureCapture({ source: 'clientFetchCached', path, siteId: SITE_ID })
    );
    console.error(`[clientFetchCached] returning fallback for ${path}:`, err);
    return fallback;
  }
}
