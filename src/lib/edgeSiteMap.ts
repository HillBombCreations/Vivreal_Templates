/**
 * Edge-safe, module-scope cache of a site's live page slugs + authored
 * redirects (docs/bugs/templates-soft-404-and-301-status, Change 1a).
 *
 * `src/middleware.ts` runs BEFORE any page component or Suspense boundary,
 * so it is the only place in this app that can guarantee a real `301` status
 * is written before the response commits (research.md's root-cause finding:
 * the page layer's `permanentRedirect()` always loses its status because the
 * sibling `loading.tsx` files used to flush a 200 shell first). This module
 * supplies the data middleware needs to make that call.
 *
 * EDGE RUNTIME CONSTRAINT: this file imports ONLY `fetch`, `URL` (both
 * ambient Web APIs), and the pure `@/lib/redirects` helper. No `server-only`,
 * no `next/headers`, no `next/cache`, no `@/lib/api/client` — those either
 * don't exist at the edge or assume a per-request scope this module's
 * background refresh does not have (the SWR refresh below can outlive the
 * request that triggered it).
 */
import type { SiteRedirect } from '@/lib/redirects';

const CLIENT_API_URL = process.env.NEXT_PUBLIC_CLIENT_API || 'https://client.vivreal.io';
// API_KEY/SITE_ID are read INSIDE fetchSiteMap (call-time), not hoisted to a
// module-scope const like CLIENT_API_URL above: both are still inlined
// identically at build time (the bundler's env replacement is textual, not
// dependent on when the surrounding code executes), and reading them
// call-time is what lets edgeSiteMap.test.ts set process.env.API_KEY /
// process.env.SITE_ID without needing to reload the module.

// 300s vs the page layer's 60s SITE_CACHE_TTL_SECONDS (src/lib/api/client.ts) —
// a stale REDIRECT map is harmless (the page layer stays authoritative for
// live content), so this copy can afford a longer TTL for fewer upstream reads.
// Exported so tests can force staleness (Date.now() - TTL_MS - 1) without
// waiting 300s of real time.
export const TTL_MS = 300_000;
const FETCH_TIMEOUT_MS = 800;

// Negative-cache window (review pass 1 hardening note): on SUSTAINED
// upstream failure `cache` never populates, so without this every document
// request on every site would re-enter fetchSiteMap() and block up to
// FETCH_TIMEOUT_MS. Skipping the network call within this window after the
// last failure restores the plan's stated property that only the FIRST
// request per instance (per failure window) can ever block.
const NEGATIVE_CACHE_MS = 30_000;

const PREVIEW_QUERY_PARAM = 'vivreal_preview';

/** Static slugs that always render regardless of pageConfigs (mirrors the
 * STATIC_SLUGS map at src/app/[slug]/page.tsx:164-168). */
const ALWAYS_LIVE_SLUGS = new Set(['privacy', 'terms']);

export interface EdgeSiteMap {
  slugs: Set<string>;
  redirects: SiteRedirect[];
}

interface CacheEntry {
  value: EdgeSiteMap;
  fetchedAt: number;
}

// Module-scope cache — lives for the lifetime of the edge instance. One entry
// only: the map is per-DEPLOYMENT (one site per Amplify app), not per-visitor,
// so there is no cache key.
let cache: CacheEntry | null = null;
// Dedupe: at most one in-flight network refresh at a time, shared by every
// concurrent request that observes a stale/absent cache.
let inFlight: Promise<EdgeSiteMap | null> | null = null;
// Negative cache: timestamp of the most recent fetchSiteMap() failure, or
// null if the last attempt succeeded (or none has run yet).
let lastFailureAt: number | null = null;

interface RawPageConfig {
  slug?: string;
}

interface RawSiteDetailsResponse {
  pages?: RawPageConfig[];
  redirects?: SiteRedirect[];
  siteDetails?: { values?: { redirects?: SiteRedirect[] } };
}

interface ApiEnvelope {
  success: boolean;
  data: RawSiteDetailsResponse;
  error: string | null;
}

/**
 * True when `pathname` can never be an authored redirect's `from`, or the
 * request explicitly opts out of the edge map via `url.search`. Cost
 * optimisation only (never a correctness guard) for the `/_next/*` and
 * `/api/*` cases; the preview-param case is a correctness requirement —
 * Studio preview must never be redirected by a cached map, and preview reads
 * already bypass every cache (src/lib/api/client.ts:200-206).
 */
export function isSkippablePath(url: URL): boolean {
  if (url.searchParams.has(PREVIEW_QUERY_PARAM)) return true;
  const { pathname } = url;
  if (pathname.startsWith('/_next/') || pathname.startsWith('/api/')) return true;
  const lastSegment = pathname.split('/').filter(Boolean).pop() ?? '';
  return lastSegment.includes('.');
}

/** First non-empty path segment, e.g. `/pages/contact-us` -> `pages`, `/` -> `''`. */
export function firstPathSegment(pathname: string): string {
  const trimmed = pathname.replace(/^\/+/, '');
  const slashIndex = trimmed.indexOf('/');
  return slashIndex === -1 ? trimmed : trimmed.slice(0, slashIndex);
}

/**
 * True when `pathname` must NEVER be shadowed by a redirect: the root, a
 * static always-on slug (privacy/terms), or a real Studio-authored page.
 * This re-establishes the invariant `src/lib/redirects.ts:44-52` documents
 * ("a redirect must never shadow live content") — middleware runs BEFORE the
 * page layer that normally enforces that ordering, so it has to be
 * re-established explicitly here. This is the single most important
 * predicate in the module.
 */
export function isLiveContentPath(pathname: string, slugs: Set<string>): boolean {
  if (pathname === '/') return true;
  const segment = firstPathSegment(pathname);
  return slugs.has(segment) || ALWAYS_LIVE_SLUGS.has(segment);
}

/** Trailing-slash-insensitive path compare, used ONLY by the loop guard below
 * — NOT a re-implementation of `resolveRedirect`'s exact-match logic (that
 * stays in `@/lib/redirects`, reused as-is). */
function normalizeForCompare(path: string): string {
  const withoutTrailingSlash = path.replace(/\/+$/, '');
  return withoutTrailingSlash === '' ? '/' : withoutTrailingSlash;
}

/**
 * Resolve `path` to a pathname via a fixed placeholder origin, so relative
 * segments and percent-encoding normalise the same way `new URL(target,
 * request.url)` will normalise the real redirect target. Never throws: a
 * malformed `path` (e.g. a bare `//` or `http://`) falls back to the raw
 * string rather than propagating the `URL` constructor's `Invalid URL`. In
 * practice `isSelfRedirectLoop` is only ever called on a `target` that has
 * already passed `isSameOriginRedirectTarget` (`@/lib/redirects`), so this
 * fallback is defensive, not load-bearing.
 */
function resolvedPathname(path: string): string {
  try {
    return new URL(path, 'https://edge-site-map.invalid').pathname;
  } catch {
    return path;
  }
}

/**
 * True when the resolved redirect `target` normalises equal to the request
 * `fromPath` — resolving it would loop the request back to itself. Middleware
 * resolves at most one hop and never follows chains, exactly as the page
 * layer does today (`[slug]/page.tsx:177-179`).
 *
 * Compares RESOLVED pathnames, not the raw strings: a raw string compare lets
 * an authored `to` that is an absolute URL pointing at this same site (e.g.
 * `https://thissite.com/contact`) bypass the loop guard against a plain
 * `/contact` request. `isSameOriginRedirectTarget` (`@/lib/redirects`)
 * already rejects any absolute-URL target before this runs in
 * `middleware.ts`, but this helper stays correct on its own regardless of
 * call-site ordering.
 */
export function isSelfRedirectLoop(fromPath: string, target: string): boolean {
  return (
    normalizeForCompare(resolvedPathname(fromPath)) === normalizeForCompare(resolvedPathname(target))
  );
}

async function fetchSiteMap(): Promise<EdgeSiteMap | null> {
  // Read call-time, not hoisted to a module-scope const -- see the comment
  // above CLIENT_API_URL.
  const apiKey = process.env.API_KEY || '';
  const siteId = process.env.SITE_ID || '';

  // Guard the env before fetching (review pass 1 hardening note): a
  // misconfigured Amplify env would otherwise pay a permanent per-request
  // FETCH_TIMEOUT_MS-bounded 401 against the real upstream on every single
  // document request. There is nothing recoverable to log here beyond what
  // the Amplify buildSpec's own env allowlist already surfaces at build
  // time -- this makes the miss inert instead of a standing per-request cost.
  if (!apiKey || !siteId) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${CLIENT_API_URL}/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`,
      {
        headers: { Authorization: apiKey },
        signal: controller.signal,
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      // Deliberate fail-open (matches clientFetchSafe's posture,
      // src/lib/api/client.ts:170-176): an upstream error here must never
      // take the whole request down. Log for visibility; the caller falls
      // back to the last-known cached value, or null if there is none.
      console.error(`[edgeSiteMap] ${res.status} ${res.statusText} fetching siteDetails`);
      return null;
    }
    const json = (await res.json()) as ApiEnvelope;
    if (!json?.success || !json.data) {
      console.error('[edgeSiteMap] siteDetails envelope missing success/data');
      return null;
    }
    const raw = json.data;
    const slugs = new Set<string>();
    for (const page of raw.pages ?? []) {
      if (page?.slug) slugs.add(page.slug);
    }
    // Dual-source read — the same one src/lib/api/siteData/index.tsx:186-190
    // performs. Today only the `siteDetails.values` copy is ever populated
    // by the migrator; reading only the top-level field yields an
    // always-empty map.
    const redirects = raw.redirects ?? raw.siteDetails?.values?.redirects ?? [];
    return { slugs, redirects };
  } catch (err) {
    // Deliberate fail-open: network error, the 800ms abort-timeout, or a
    // malformed body must never throw out of middleware — a throw there
    // takes the whole request down on EVERY route. Log and fall back.
    console.error('[edgeSiteMap] fetch failed, failing open:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Stale-while-revalidate read of the edge site map.
 *
 * - Fresh cache: return immediately, no network.
 * - Stale cache: return the stale value immediately AND kick off (at most
 *   one, deduped) background refresh for the NEXT call — the caller that
 *   creates `inFlight` does NOT await it either; it reads `cache` and
 *   returns synchronously below, same as every other stale-cache caller.
 * - Cold cache (first request on this instance, no prior `cache` entry):
 *   every concurrent caller observes `cache === null` and falls through to
 *   `return inFlight` at the bottom — ALL of them await the shared,
 *   deduped promise, bounded by the 800ms AbortController timeout in
 *   `fetchSiteMap`. Only a warm cache (fresh or stale) ever avoids blocking.
 * - Any failure: returns the last-known value, or `null` if there is none.
 *   `middleware.ts` treats `null` as "fall through, do nothing" — never as
 *   an error to propagate.
 * - Negative cache: within NEGATIVE_CACHE_MS of the last failure, skips the
 *   network call entirely (returns the last-known value, or `null`) rather
 *   than re-attempting and re-blocking up to FETCH_TIMEOUT_MS on sustained
 *   upstream outage.
 */
export async function getEdgeSiteMap(): Promise<EdgeSiteMap | null> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.value;
  }

  if (
    !inFlight &&
    lastFailureAt !== null &&
    now - lastFailureAt < NEGATIVE_CACHE_MS
  ) {
    // Sustained upstream failure -- skip the network call for this window.
    // Still fail-open to the last-known value if one exists.
    return cache ? cache.value : null;
  }

  if (!inFlight) {
    inFlight = fetchSiteMap()
      .then((value) => {
        if (value) {
          cache = { value, fetchedAt: Date.now() };
          lastFailureAt = null;
        } else {
          lastFailureAt = Date.now();
        }
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  if (cache) {
    // Stale-while-revalidate: serve the stale value now. The in-flight
    // refresh's `.then` above updates `cache` for the NEXT call once it
    // resolves — this call does not await it.
    return cache.value;
  }

  // Cold cache: this call (and every concurrent call sharing `inFlight`)
  // must actually wait for the network.
  return inFlight;
}

/**
 * Test-only escape hatch: clears the module-scope cache + in-flight promise.
 * `edgeSiteMap.test.ts` runs every case in one process (Node's test runner
 * isolates by FILE, not by individual `test()`), and this module's cache is
 * intentionally cross-request/instance-scoped — without a reset, only the
 * FIRST test's mocked `fetch` would ever be observed. Never called from
 * `middleware.ts` or any production path.
 */
export function __resetEdgeSiteMapCacheForTests(): void {
  cache = null;
  inFlight = null;
  lastFailureAt = null;
}

/**
 * Test-only escape hatch: rewinds the already-populated cache entry's
 * `fetchedAt` so the NEXT `getEdgeSiteMap()` call treats it as stale, without
 * waiting for the real 300s TTL to elapse. This is what makes the
 * stale-cache + failing-refresh fail-open path (review pass 1, Item 3a)
 * testable in a fast unit test — a freshly-populated cache (the common case)
 * always returns before any network call, so that path is otherwise
 * unreachable in-process. No-op if nothing is cached yet. Never called from
 * `middleware.ts` or any production path.
 */
export function __setCacheFetchedAtForTests(fetchedAt: number): void {
  if (cache) {
    cache = { value: cache.value, fetchedAt };
  }
}
