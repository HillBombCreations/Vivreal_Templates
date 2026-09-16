/**
 * `fetch`, retried when the CONNECTION fails rather than the request.
 *
 * WHY THIS EXISTS (measured on the live fleet, 2026-09-16)
 * ------------------------------------------------------
 * Amplify compute runs each request as a short Lambda invocation and freezes
 * the process the moment the response is sent. A keep-alive socket to
 * `client.vivreal.io` that was idle in the pool across that freeze is often
 * dead by the next request (the far end or a middlebox closed it while this
 * process could not answer). Reusing it fails FAST, before any byte of the
 * request reaches VR_Client_API:
 *
 *   - The Comedy Collective, 19:17:38: `TypeError: fetch failed`, cause
 *     `write ETIMEDOUT`, 67 ms into the invocation, after 238 s idle.
 *   - Waves of Grain, 19:38:23: `TypeError: fetch failed`, cause `ECONNRESET`
 *     "Client network socket disconnected before secure TLS connection was
 *     established", after 37 s idle.
 *
 * Both times `clientFetchCached` fell back to degraded data and `robots.txt`
 * refused to serve (`DegradedUpstreamError`), and the NEXT request succeeded.
 * One more attempt on a fresh connection is what that next request did.
 *
 * WHAT IS RETRIED, AND WHAT NEVER IS
 * ---------------------------------
 *  - Only a rejection of `fetch()` itself, and only a `TypeError`. The fetch
 *    standard reports a network error as a `TypeError`; an HTTP response of any
 *    status is a resolved `Response` and is returned untouched, so a 500, a 402
 *    quota answer or a frozen-group 400 is never repeated.
 *  - Only `GET` and `HEAD`. A `POST` that died mid-flight may have reached the
 *    server, so it is never replayed here.
 *  - Never after the caller's own `signal` has aborted: an abort is the
 *    caller's decision, not a transport fault.
 *  - At most `NETWORK_RETRIES` extra attempts. The pool can hold more than one
 *    socket that went stale across the same freeze, and each fails in well
 *    under a second, so two is cheap; beyond that the upstream is really down
 *    and the caller's own fail-open path should take over.
 *
 * Edge-safe: ambient `fetch` only, no Node imports. `src/lib/edgeSiteMap.ts`
 * imports this, and so does `./clientFetchCore.ts`.
 */

/** Extra attempts after the first, for connection-level failures only. */
export const NETWORK_RETRIES = 2;

export interface ReconnectOptions {
  /** Extra attempts after the first. Defaults to `NETWORK_RETRIES`. */
  readonly retries?: number;
  /** Called before each retry with the error that caused it (1-based). */
  readonly onRetry?: (err: unknown, retry: number) => void;
}

/** True when a `fetch()` rejection is a transport failure worth one more try. */
export function isTransientNetworkError(err: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) return false;
  return err instanceof TypeError;
}

/**
 * The most specific description a network error carries: undici puts the
 * socket error (`ECONNRESET`, `ETIMEDOUT`, `UND_ERR_SOCKET`, ...) on `cause`.
 */
export function describeNetworkError(err: unknown): string {
  const cause = (err as { cause?: { code?: unknown; message?: unknown } } | null)?.cause;
  if (cause && typeof cause.code === 'string') return cause.code;
  if (cause && typeof cause.message === 'string') return cause.message;
  return err instanceof Error ? err.message : String(err);
}

export async function fetchWithReconnect(
  input: string | URL,
  init?: RequestInit,
  options: ReconnectOptions = {},
): Promise<Response> {
  const retries = options.retries ?? NETWORK_RETRIES;
  const method = (init?.method ?? 'GET').toUpperCase();
  const replayable = method === 'GET' || method === 'HEAD';

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (!replayable || attempt >= retries || !isTransientNetworkError(err, init?.signal)) {
        throw err;
      }
      options.onRetry?.(err, attempt + 1);
    }
  }
}
