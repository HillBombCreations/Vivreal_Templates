/**
 * Centralized VR_Client_API server-side client.
 *
 * All data fetching from VR_Client_API goes through this module.
 * Automatically unwraps the { success, data, error } response envelope.
 */
import 'server-only';
import { headers } from 'next/headers';

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
 * Fetch data from VR_Client_API with auth.
 * Unwraps the { success, data, error } envelope automatically.
 */
export async function clientFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${CLIENT_API_URL}${path}`;

  const previewToken = await readPreviewToken();
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

/** Check if an error is a 402 quota exceeded error. */
export function isQuotaError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402;
}
