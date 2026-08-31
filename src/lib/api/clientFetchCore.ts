/**
 * The VR_Client_API request itself: URL, headers, envelope unwrap, error
 * shape. Nothing Next-specific, nothing `server-only`.
 *
 * Split out of `./client.ts` for one reason: `client.ts` imports `server-only`
 * and `next/headers`, so `node --experimental-strip-types --test` cannot load
 * it, which left the single most consequential line in this repo — the one
 * that puts the portal preview token on the outbound request as
 * `x-vivreal-preview` — provable only by grepping the source. That header is
 * what makes VR_Client_API set `previewBypass = true` and skip both the quota
 * gate and `trackApiUsage` (`VR_Client_API/src/api/handlers.js`), so "it is
 * still spelled right" is not good enough: `clientFetchCore.test.ts` now
 * drives this function against a stubbed `fetch` and reads the header off the
 * real outbound request.
 *
 * Same move, same motivation, as `src/lib/cacheInvalidation.ts`.
 *
 * The API key is passed IN rather than read from `process.env` here, so this
 * module holds no secret of its own and stays safe to import from anywhere.
 * `client.ts` remains the only place that reads `API_KEY`.
 */
import { PREVIEW_FORWARD_HEADER } from './previewToken.ts';

/** Where to send the request, and what to authenticate it with. */
export interface ClientApiConfig {
  /** VR_Client_API origin, no trailing slash. */
  readonly baseUrl: string;
  /** Value for the `Authorization` header. */
  readonly apiKey: string;
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

/** Check if an error is a 402 quota exceeded error. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}

/**
 * Compose the outbound header set.
 *
 * Caller-supplied `extra` headers may override `Authorization` and
 * `Content-Type` (that was already true and one caller relies on it to send
 * the bot verdict), but the preview header is applied LAST and is therefore
 * not overridable — a caller must not be able to accidentally strip the quota
 * bypass, and no caller has any reason to set it itself.
 */
export function buildClientFetchHeaders(
  apiKey: string,
  previewToken: string | null,
  extra?: HeadersInit,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: apiKey,
    'Content-Type': 'application/json',
    ...(extra as Record<string, string> | undefined),
  };
  if (previewToken) headers[PREVIEW_FORWARD_HEADER] = previewToken;
  return headers;
}

/**
 * Core fetch + envelope-unwrap. Takes the preview token explicitly so this can
 * be invoked from inside a cache scope (`unstable_cache`), where request APIs
 * like `cookies()` are not permitted.
 */
export async function doClientFetch<T>(
  config: ClientApiConfig,
  path: string,
  previewToken: string | null,
  init?: RequestInit,
): Promise<T> {
  const url = `${config.baseUrl}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: buildClientFetchHeaders(config.apiKey, previewToken, init?.headers),
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
