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
 * WHY A BACKOFF WAS ADDED (idle-dead-socket-research-2026-10-04.md)
 * -------------------------------------------------------------------
 * The first version of this module retried immediately. The fleet-wide
 * measurement (09-16 to 10-04) found the retry recovers 83% of connection
 * failures, but the other 17% are not a dead-socket problem: they are a
 * POST-THAW NETWORK IMPAIRMENT WINDOW, tens of ms up to about 1.6s, during
 * which even a BRAND-NEW connection to client.vivreal.io fails (measured:
 * 137 of 137 classifiable terminal attempts were new connections, not reused
 * ones). Three zero-delay attempts can all land inside a window that outlasts
 * them. `backoffMs` (awake time, see `../awakeTimeout.ts`) gives a later
 * retry a chance to land after the window closes, which the next real
 * invocation always did (44 of 45 observed cases). It is awake time and not
 * `setTimeout` specifically because a wall-clock timer armed right before a
 * freeze is already overdue the instant the process thaws — the same defect
 * `../awakeTimeout.ts` exists to fix in `edgeSiteMap.ts`.
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
 *    caller's decision, not a transport fault. The awake-time wait between
 *    attempts is cancelled early by the same abort, so a caller's own deadline
 *    (e.g. `edgeSiteMap.ts`'s 800ms budget) is never held open past it.
 *  - At most `NETWORK_RETRIES` extra attempts. The pool can hold more than one
 *    socket that went stale across the same freeze, and each fails in well
 *    under a second, so two is cheap; beyond that the upstream is really down
 *    and the caller's own fail-open path should take over.
 *
 * LOGGING
 * -------
 * Every attempt that fails (whether retried or finally thrown) is logged here,
 * once, as a small structured line: attempt number, elapsed ms since this call
 * started (awake time by construction — nothing can freeze mid-request, only
 * between requests), the network error code, and `bytesWritten`/`bytesRead`
 * when undici attached them (it does for `UND_ERR_SOCKET`). Never the query
 * string: every call site here puts a tenant identifier (`siteId`,
 * `collectionId`) there, never a secret, but logging it anyway would mint one
 * log line per tenant and make a fleet-wide pattern unreadable. A successful
 * attempt (first try, or a retry that lands) logs nothing, to keep this quiet
 * on a healthy fleet.
 *
 * PER-MODULE-INSTANCE SHORT-CIRCUIT (review-templates-183.md, concern 3)
 * ------------------------------------------------------------------
 * The backoff above is deliberately slow per call so a single post-thaw blip
 * can wait itself out. That is the wrong shape once the upstream is actually
 * down: a render with N serial reads would pay the full backoff N times
 * (measured: a 14-read render goes from about 0.5s to about 10s during a real
 * outage). See `SHORT_CIRCUIT_WINDOW_MS` below for the fix.
 *
 * Edge-safe: ambient `fetch`/`AbortSignal`/`console` plus `../awakeTimeout.ts`,
 * itself edge-safe (see its header). No Node-only import.
 * `src/lib/edgeSiteMap.ts` imports this, and so does `./clientFetchCore.ts`.
 */
import { startAwakeTimeout } from '../awakeTimeout.ts';

/** Extra attempts after the first, for connection-level failures only. */
export const NETWORK_RETRIES = 2;

/**
 * Awake-time ms to wait before each retry, by (0-based) retry index — index 0
 * is the wait before retry 1, index 1 before retry 2. The last entry repeats
 * for any further retry. `[150, 500]` keeps the combined wait (650ms) well
 * under the roughly 1.6s worst-case tail this research measured, while
 * landing after the window's p50/p90 (89ms / 427ms to the last observed
 * failure) in most cases. Opt-in per call site (default is `[]`, i.e. no
 * wait) rather than a default on the function itself, so every caller that
 * does not explicitly ask for a backoff — including every existing test here
 * — keeps today's zero-delay behaviour unchanged.
 */
export const DEFAULT_BACKOFF_MS: readonly number[] = [150, 500];

/**
 * How long, after ANY call in this MODULE INSTANCE exhausts its retries on a
 * genuine transient network error, every OTHER call sharing that same
 * instance skips the backoff wait between attempts (review-templates-183.md,
 * concern 3). The retries themselves still run — a recovery inside the
 * window is not lost — only the wait that assumes the post-thaw window is
 * still live is skipped, which is what bounds the worst case: a render with
 * many serial reads during a real outage pays the backoff at most once, not
 * once per read.
 *
 * Per module instance, NOT per process (review-templates-183.md pass 2,
 * concern 2 — this is the same realm-vs-process wording that produced B1 in
 * pass 1, fixed here before it causes a second one). Next bundles this file
 * separately into the middleware sandbox, each edge route's own sandbox
 * (`/api/contact` among them) and the Node-runtime render, and each bundle
 * gets its OWN copy of `lastExhaustedAt` — there is no cross-realm Agent
 * trick available to this module state the way there was for undici's
 * dispatcher. That is fail-safe: less short-circuiting only ever means
 * falling back to the full backoff, never skipping a wait that should have
 * run. The case this exists for — serial reads in one render through
 * `clientFetchCore` — is entirely within one instance, so it is unaffected.
 *
 * Wall-clock time, not awake time. Unlike the backoff schedule itself, there
 * is nothing to survive a freeze for here in the common case: an Amplify
 * freeze usually happens BETWEEN invocations, which is exactly the kind of
 * gap that should EXPIRE this (the freeze was time for the upstream to
 * recover, so the next invocation deserves a full backoff chance again, not a
 * short-circuited one). That is not a universal guarantee, though — a
 * background ISR regeneration that outlives the response it was triggered by
 * can itself be frozen mid-flight, between two calls inside what is still
 * logically one invocation (pass 1, B2) — but the consequence is the same
 * fail-safe direction either way: the window either expires across the
 * freeze (short-circuit lost, full backoff resumes) or it does not (window
 * still armed, nothing worse than today's short-circuited wait). Nothing
 * here depends on the freeze NEVER happening mid-invocation, only on expiry
 * being harmless when it does.
 */
export const SHORT_CIRCUIT_WINDOW_MS = 3_000;

let lastExhaustedAt: number | null = null;

function isShortCircuited(now: number): boolean {
  return lastExhaustedAt !== null && now - lastExhaustedAt < SHORT_CIRCUIT_WINDOW_MS;
}

/** Test-only: module state otherwise persists for the life of the process,
 * exactly like the production container it is modeling. */
export function __resetShortCircuitForTests(): void {
  lastExhaustedAt = null;
}

export interface ReconnectOptions {
  /** Extra attempts after the first. Defaults to `NETWORK_RETRIES`. */
  readonly retries?: number;
  /** Called before each retry with the error that caused it (1-based). */
  readonly onRetry?: (err: unknown, retry: number) => void;
  /** Awake-time ms to wait before each retry. Defaults to `[]` (no wait) —
   * see `DEFAULT_BACKOFF_MS` for the schedule production call sites use. */
  readonly backoffMs?: readonly number[];
  /** Tag on this call's structured log line (e.g. `'clientFetch'`,
   * `'edgeSiteMap'`). Defaults to `'fetchWithReconnect'`. */
  readonly label?: string;
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

/** Drop the query string before it reaches a log line — every call site here
 * puts a tenant identifier there, and logging it would explode a fleet-wide
 * pattern into one line per tenant. */
function pathOnly(input: string | URL): string {
  const href = typeof input === 'string' ? input : input.toString();
  const queryIndex = href.indexOf('?');
  return queryIndex === -1 ? href : href.slice(0, queryIndex);
}

/** The byte counters undici attaches directly to a `UND_ERR_SOCKET` cause
 * (confirmed live, 2026-10-04: 77 of 77 carried `bytesWritten: 747,
 * bytesRead: 0`). Absent on every other cause — read opportunistically, never
 * assumed present. */
function socketByteCounters(err: unknown): { bytesWritten?: number; bytesRead?: number } {
  const cause = (err as { cause?: Record<string, unknown> } | null)?.cause;
  if (!cause || typeof cause !== 'object') return {};
  const { bytesWritten, bytesRead } = cause;
  return {
    ...(typeof bytesWritten === 'number' ? { bytesWritten } : {}),
    ...(typeof bytesRead === 'number' ? { bytesRead } : {}),
  };
}

/** One small structured line per failed attempt. See the module header for
 * what this is for and why a successful attempt logs nothing. */
function logAttempt(
  label: string,
  fields: {
    attempt: number;
    outcome: 'retrying' | 'failed';
    elapsedMs: number;
    path: string;
    errorCode: string;
    bytesWritten?: number;
    bytesRead?: number;
  },
): void {
  const line = JSON.stringify(fields);
  if (fields.outcome === 'failed') {
    console.error(`[${label}] ${line}`);
  } else {
    console.warn(`[${label}] ${line}`);
  }
}

/** Resolve after `ms` of AWAKE time (never wall-clock — see the module
 * header), or immediately if the caller's own signal aborts first, so a
 * bounded caller (e.g. `edgeSiteMap.ts`'s 800ms budget) is never held open
 * past its own deadline by a wait that has nothing left to accomplish. */
async function awaitAwake(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0 || signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timeout = startAwakeTimeout(ms, resolve);
    signal?.addEventListener(
      'abort',
      () => {
        timeout.cancel();
        resolve();
      },
      { once: true },
    );
  });
}

export async function fetchWithReconnect(
  input: string | URL,
  init?: RequestInit,
  options: ReconnectOptions = {},
): Promise<Response> {
  const retries = options.retries ?? NETWORK_RETRIES;
  const backoffMs = options.backoffMs ?? [];
  const label = options.label ?? 'fetchWithReconnect';
  const method = (init?.method ?? 'GET').toUpperCase();
  const replayable = method === 'GET' || method === 'HEAD';
  const startedAt = Date.now();

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (err) {
      const transient = isTransientNetworkError(err, init?.signal);
      const canRetry = replayable && attempt < retries && transient;
      logAttempt(label, {
        attempt: attempt + 1,
        outcome: canRetry ? 'retrying' : 'failed',
        elapsedMs: Date.now() - startedAt,
        path: pathOnly(input),
        errorCode: describeNetworkError(err),
        ...socketByteCounters(err),
      });
      if (!canRetry) {
        // A genuine transient failure that ran out of retries (not: not
        // replayable, not: the caller's own abort) arms the short-circuit for
        // every OTHER call sharing this module instance — see
        // `SHORT_CIRCUIT_WINDOW_MS` for what "instance" means here.
        if (replayable && transient && attempt >= retries) {
          lastExhaustedAt = Date.now();
        }
        throw err;
      }
      options.onRetry?.(err, attempt + 1);
      const wait = isShortCircuited(Date.now())
        ? 0
        : (backoffMs[Math.min(attempt, backoffMs.length - 1)] ?? 0);
      await awaitAwake(wait, init?.signal);
    }
  }
}
