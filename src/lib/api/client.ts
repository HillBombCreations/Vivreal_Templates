/**
 * Centralized VR_Client_API server-side client.
 *
 * All data fetching from VR_Client_API goes through this module.
 * Automatically unwraps the { success, data, error } response envelope.
 */
import 'server-only';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { BOT_VERDICT_HEADER } from '../botVerdict';
import { buildFetchFailureCapture } from './errorCapture';

const CLIENT_API_URL =
  process.env.NEXT_PUBLIC_CLIENT_API || 'https://client.vivreal.io';

const API_KEY = process.env.API_KEY || '';

/**
 * This deployment's siteId. Used ONLY as a Sentry tag so a fleet-wide upstream
 * failure (one Issue, by fingerprint) can still be filtered down to the sites it
 * actually hit. Never part of a fingerprint - see ./errorCapture.
 */
const SITE_ID = process.env.SITE_ID || '';

const PREVIEW_REQUEST_HEADER = 'x-vivreal-preview-token';
const PREVIEW_FORWARD_HEADER = 'x-vivreal-preview';

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
 * scope. middleware.ts injects it from `?vivreal_preview=<token>` on the
 * inbound URL; we relay it as `x-vivreal-preview` on every server-to-server
 * fetch so VR_Client_API can skip quota tracking for portal-driven previews.
 *
 * `headers()` throws when called outside a request scope (e.g., during a
 * build-time prerender). In that case we just have no token and the call
 * is tracked normally — exactly the right fallback.
 */
async function readPreviewToken(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get(PREVIEW_REQUEST_HEADER);
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
 * Fails open to `'0'` (not-a-bot) — same posture as `readPreviewToken`:
 * `headers()` throws outside a request scope (e.g. a build-time prerender),
 * and an inability to prove "bot" must never silently drop capture for a
 * real visitor. Absent header (any caller that isn't this middleware, or a
 * not-yet-rebuilt deployment) resolves the same way.
 */
export async function readBotVerdict(): Promise<'0' | '1'> {
  try {
    const h = await headers();
    return h.get(BOT_VERDICT_HEADER) === '1' ? '1' : '0';
  } catch {
    return '0';
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error: string | null;
}

/** Custom error that preserves the HTTP status code. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Core fetch + envelope-unwrap. Takes the preview token explicitly so this can
 * be invoked from inside a cache scope (unstable_cache), where request APIs
 * like headers() are not permitted.
 */
async function doClientFetch<T>(
  path: string,
  previewToken: string | null,
  init?: RequestInit
): Promise<T> {
  const url = `${CLIENT_API_URL}${path}`;

  const fwdHeaders: Record<string, string> = {
    Authorization: API_KEY,
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (previewToken) fwdHeaders[PREVIEW_FORWARD_HEADER] = previewToken;

  const res = await fetch(url, {
    ...init,
    headers: fwdHeaders,
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`[clientFetch] ${res.status} ${res.statusText} — ${url}`);
    throw new ApiError(`VR_Client_API ${res.status}: ${res.statusText}`, res.status);
  }

  const json = await res.json();

  // Unwrap the { success, data, error } envelope
  if (json && typeof json === 'object' && 'success' in json) {
    const envelope = json as ApiEnvelope<T>;
    if (!envelope.success) {
      throw new ApiError(`VR_Client_API error: ${envelope.error || 'Unknown error'}`, 500);
    }
    return envelope.data;
  }

  return json as T;
}

/**
 * Fetch data from VR_Client_API with auth.
 * Unwraps the { success, data, error } envelope automatically.
 */
export async function clientFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  return doClientFetch<T>(path, await readPreviewToken(), init);
}

/**
 * Safe version — returns fallback on error instead of throwing.
 * Re-throws ApiError with status 402 (quota exceeded / frozen account)
 * so the page can render the QuotaExceeded component.
 */
export async function clientFetchSafe<T>(
  path: string,
  fallback: T,
  init?: RequestInit
): Promise<T> {
  try {
    return await clientFetch<T>(path, init);
  } catch (err) {
    // Let 402 (quota/frozen) bubble up so pages can show the quota page
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
 * on every render. Works even though the content routes are `force-dynamic` —
 * unstable_cache is independent of route segment config.
 *
 * Safety:
 * - Preview requests (carrying a per-request token) BYPASS the cache entirely —
 *   they must always be fresh, and request APIs (headers()) can't be read inside
 *   a cache scope.
 * - 402 (quota/frozen) is never cached: it re-throws so the page re-evaluates
 *   quota state on the next request.
 * - Cache key includes `path` (so different siteIds/params are isolated); each
 *   customer site is its own deployment, so entries are effectively per-site.
 * - Callers must keep `revalidateSeconds` UNDER VR_Client_API's 300s signed
 *   media-URL TTL so cached payloads never carry expired CDN links — UNLESS the
 *   payload is media-free (see the cache-invalidation design, signed-URL crux).
 *
 * On-demand invalidation:
 * - Pass `tags` (e.g. `['site:<id>']`, `['collection:<id>']`) to make the entry
 *   invalidatable via `revalidateTag(tag, 'max')` from the `/api/revalidate`
 *   route handler when the owning content is edited in the portal. The time
 *   `revalidateSeconds` then acts purely as a backstop for missed webhooks.
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
    async () => doClientFetch<T>(path, null, init),
    ['vr-client-api', path],
    { revalidate: revalidateSeconds, ...(tags && tags.length ? { tags } : {}) }
  );

  try {
    return await cached();
  } catch (err) {
    // Let 402 (quota/frozen) bubble up so pages can show the quota page; never cache it.
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

/** Check if an error is a 402 quota exceeded error. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
