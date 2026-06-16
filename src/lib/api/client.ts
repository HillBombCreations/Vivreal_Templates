/**
 * Centralized VR_Client_API server-side client.
 *
 * All data fetching from VR_Client_API goes through this module.
 * Automatically unwraps the { success, data, error } response envelope.
 */
import 'server-only';
import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';

const CLIENT_API_URL =
  process.env.NEXT_PUBLIC_CLIENT_API || 'https://client.vivreal.io';

const API_KEY = process.env.API_KEY || '';

const PREVIEW_REQUEST_HEADER = 'x-vivreal-preview-token';
const PREVIEW_FORWARD_HEADER = 'x-vivreal-preview';

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
    console.error(`[clientFetchCached] returning fallback for ${path}:`, err);
    return fallback;
  }
}

/** Check if an error is a 402 quota exceeded error. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
