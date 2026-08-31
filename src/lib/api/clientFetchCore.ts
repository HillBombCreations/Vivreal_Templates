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
  /**
   * Added by VR_Client_API v2.6.2 (PR #70). Present ONLY for a `CustomError`,
   * so it is exactly the closed set in `VR_Client_API/src/scripts/customError.js`
   * — `GroupFrozen`, `IntegrationNotActive`, `ExpectedError`, `Failure` — and
   * absent on every other failure. Optional here because older responses, and
   * any error that is not a `CustomError`, simply do not carry it.
   */
  code?: string | null;
}

/**
 * Custom error that preserves the HTTP status code and, when the upstream sent
 * one, the machine-readable `code` and the server's own sentence.
 *
 * `status` and its meaning are unchanged; `code` and `serverMessage` are
 * purely additive. `isQuotaError` below still keys off `status` alone.
 */
export class ApiError extends Error {
  status: number;
  /**
   * VR_Client_API's stable discriminator for by-design denials, off the
   * envelope's `code` field.
   *
   * `null` whenever the upstream did not send one — every non-`CustomError`
   * failure, and every response whose body could not be read. So a consumer
   * MUST read `null` as "unknown", never as "not frozen": that is the same
   * fail-open posture `recordFrozenVerdictFromError` takes in `edgeSiteMap.ts`,
   * and for the same reason. A false freeze takes a paying customer's site
   * down.
   */
  readonly code: string | null;
  /**
   * The envelope's `error` sentence, verbatim and unprefixed. Kept separate
   * from `message` so a caller can surface the upstream's own words without
   * stripping our `VR_Client_API <status>` prefix back off.
   */
  readonly serverMessage: string | null;

  constructor(
    message: string,
    status: number,
    details?: { code?: string | null; serverMessage?: string | null },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = details?.code ?? null;
    this.serverMessage = details?.serverMessage ?? null;
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
 * Best-effort read of a failed response's envelope.
 *
 * NEVER THROWS, and that is the entire contract. This runs on the failure
 * path, where the only job left is to describe the failure: a `SyntaxError`
 * escaping from here would replace a diagnosable `VR_Client_API 503` with an
 * opaque JSON parse error, which is strictly worse than the blindness it is
 * fixing. An empty body, one of CloudFront's HTML error pages, or an aborted
 * stream all degrade to two nulls and the caller falls back to the status line
 * alone.
 *
 * Consumes the body. Safe because both callers throw immediately after, so
 * nothing reads the response again.
 */
async function readErrorEnvelope(
  res: Response,
): Promise<{ code: string | null; serverMessage: string | null }> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object') {
      const { code, error } = body as { code?: unknown; error?: unknown };
      return {
        code: typeof code === 'string' && code ? code : null,
        serverMessage: typeof error === 'string' && error ? error : null,
      };
    }
  } catch {
    // Unreadable or non-JSON body. Nothing recoverable, and nothing to log
    // that the caller's own console.error does not already say.
  }
  return { code: null, serverMessage: null };
}

/**
 * Compose the thrown `message`, which is what becomes the Sentry issue title.
 *
 * `res.statusText` is very often the EMPTY STRING here: HTTP/2 carries no
 * reason phrase and API Gateway supplies none, so before this a frozen-account
 * failure could reach Sentry titled literally `VR_Client_API 400: `. Appending
 * the code and the upstream sentence is what makes the title say which denial
 * it was, which is the whole point of the ticket.
 */
function describeFailure(
  status: number,
  statusText: string,
  code: string | null,
  serverMessage: string | null,
): string {
  const label = code ? `${status} (${code})` : `${status}`;
  const detail = serverMessage || statusText;
  return detail ? `VR_Client_API ${label}: ${detail}` : `VR_Client_API ${label}`;
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
    // Read the body BEFORE throwing. Until v2.6.2 this module discarded it
    // entirely, which is why the 2026-08-31 Atlas incident reached Sentry as a
    // bare status with no upstream reason attached, and why the middleware
    // frozen gate had to bypass this module and read `edgeSiteMap`'s raw
    // `Response` to see the `GroupFrozen` code at all.
    const { code, serverMessage } = await readErrorEnvelope(res);
    console.error(
      `[clientFetch] ${res.status} ${res.statusText} — ${url}` +
        (code ? ` — code=${code}` : '') +
        (serverMessage ? ` — ${serverMessage}` : ''),
    );
    throw new ApiError(
      describeFailure(res.status, res.statusText, code, serverMessage),
      res.status,
      { code, serverMessage },
    );
  }

  const json = await res.json();

  // Unwrap the { success, data, error } envelope
  if (json && typeof json === 'object' && 'success' in json) {
    const envelope = json as ApiEnvelope<T>;
    if (!envelope.success) {
      // `res.status`, not a hardcoded 500. A 2xx carrying `success: false` is
      // rare but real, and flattening it invented an upstream server error
      // that never happened. `isQuotaError` is unaffected in either direction:
      // a 402 never reaches this branch, `!res.ok` catches it above.
      const code = typeof envelope.code === 'string' && envelope.code ? envelope.code : null;
      const serverMessage = envelope.error || null;
      throw new ApiError(
        `VR_Client_API error${code ? ` (${code})` : ''}: ${serverMessage || 'Unknown error'}`,
        res.status,
        { code, serverMessage },
      );
    }
    return envelope.data;
  }

  return json as T;
}
