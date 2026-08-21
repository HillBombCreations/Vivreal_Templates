/**
 * Sentry capture shapes for VR_Client_API read failures (TRAIN-1.54.0 gap 2a).
 *
 * WHY THIS MODULE EXISTS AT ALL
 *
 * Every SSR read in this app goes through `clientFetchSafe` / `clientFetchCached`
 * in `./client`, and both of those SWALLOW upstream failures by design: they log
 * to `console.error` and return the caller's fallback so a single dead endpoint
 * can't 500 a whole page. `getSiteData` then turns a null payload into
 * `FALLBACK_SITE_DATA` and the site renders black-and-white and empty.
 *
 * Nothing throws anywhere on that path. `src/app/error.tsx` and
 * `src/app/global-error.tsx` are React error boundaries and REQUIRE a throw, and
 * `src/instrumentation.ts` exports no `onRequestError` hook, so Sentry is
 * unreachable from a swallowed failure. That is why the 2026-08-20 incident
 * produced a visually-confirmed fallback render with zero errors, zero logs and
 * zero spans in Sentry — the outage was found by a human looking at a screenshot.
 *
 * WHY THE SHAPES LIVE HERE AND NOT INLINE
 *
 * `./client` imports `server-only`, `next/headers` and `next/cache`, none of
 * which load under the repo's `node --test` runner. Keeping the grouping and
 * tagging rules in this dependency-free module is what makes them testable at
 * all (see `errorCapture.test.ts`); `client.ts` and `siteData/index.tsx` import
 * from here rather than each hand-rolling a capture context.
 */

/** Where a swallowed upstream failure was caught. Tagged, not fingerprinted. */
export type FetchFailureSource = 'clientFetchSafe' | 'clientFetchCached';

/**
 * The subset of Sentry's `CaptureContext` these helpers produce. Structural, so
 * this module stays free of a `@sentry/nextjs` import and therefore loadable by
 * the plain-node test runner.
 */
export interface SentryCaptureContext {
  level: 'error';
  fingerprint: string[];
  tags: Record<string, string>;
}

/**
 * Fingerprint root for "an upstream read failed and the caller silently took its
 * fallback". One Issue per API path, fleet-wide.
 */
export const FETCH_FAILURE_FINGERPRINT = 'templates.clientApi.fetchFailure';

/**
 * Fingerprint root for the distinct, and far more alertable, business condition:
 * "this site rendered as the empty fallback page". Deliberately separate from
 * FETCH_FAILURE_FINGERPRINT — one failed fetch is a blip, a fallback render is
 * an outage the visitor can see.
 */
export const SITE_DETAILS_FALLBACK_FINGERPRINT = 'templates.siteDetails.fallback';

/** Message body for the fallback-render capture (there is no error object). */
export const SITE_DETAILS_FALLBACK_MESSAGE =
  'siteDetails unavailable — site rendered from FALLBACK_SITE_DATA';

/** Tag value used when a tenant identifier is not available at capture time. */
const UNKNOWN_SITE_ID = 'unknown';

/**
 * Drop the query string from an API path.
 *
 * Load-bearing for grouping: every call site interpolates tenant-specific values
 * into the query (`?siteId=...`, `?collectionId=...`), so fingerprinting the raw
 * path would mint one Sentry Issue PER SITE and destroy the fleet-wide signal —
 * exactly the failure the ops pre-flight warned about. The path itself carries no
 * tenant data; the tenant goes in `tags.siteId`, where it stays filterable.
 */
export function stripQueryString(path: string): string {
  const queryIndex = path.indexOf('?');
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

/**
 * Capture context for a swallowed VR_Client_API read failure.
 *
 * 402 (quota exceeded / frozen account) never reaches this helper: both catch
 * blocks in `./client` re-throw it before the capture, and an expected business
 * state must not page anyone.
 */
export function buildFetchFailureCapture({
  source,
  path,
  siteId,
}: {
  source: FetchFailureSource;
  path: string;
  siteId: string | undefined;
}): SentryCaptureContext {
  const normalizedPath = stripQueryString(path);
  return {
    level: 'error',
    fingerprint: [FETCH_FAILURE_FINGERPRINT, normalizedPath],
    tags: {
      source,
      path: normalizedPath,
      siteId: siteId || UNKNOWN_SITE_ID,
    },
  };
}

/**
 * Capture context for "getSiteData returned FALLBACK_SITE_DATA".
 *
 * Fingerprint carries no tenant component on purpose: a fleet-wide upstream
 * outage must collapse into ONE Issue whose event count spikes, because an
 * event-count threshold is what an alert rule can actually fire on.
 */
export function buildSiteDetailsFallbackCapture({
  siteId,
}: {
  siteId: string | undefined;
}): SentryCaptureContext {
  return {
    level: 'error',
    fingerprint: [SITE_DETAILS_FALLBACK_FINGERPRINT],
    tags: {
      siteId: siteId || UNKNOWN_SITE_ID,
    },
  };
}
