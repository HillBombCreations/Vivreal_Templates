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
 * EDGE RUNTIME CONSTRAINT: this file imports ONLY `fetch`, `URL`,
 * `AbortController` and the `setTimeout`/`clearTimeout` pair (all ambient Web
 * APIs, and all four are provided by the Next middleware sandbox:
 * next/dist/server/web/sandbox/context.js wires `setTimeout`/`clearTimeout` to
 * its TimeoutsManager). Plus the pure `@/lib/redirects` helper.
 * No `server-only`,
 * no `next/headers`, no `next/cache`, no `@/lib/api/client` — those either
 * don't exist at the edge or assume a per-request scope this module's
 * background refresh does not have (the SWR refresh below can outlive the
 * request that triggered it).
 */
import type { SiteRedirect } from '@/lib/redirects';
import { describeNetworkError, fetchWithReconnect } from './api/fetchWithReconnect.ts';
import { startAwakeTimeout } from './awakeTimeout.ts';

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
// Measured in AWAKE time (`./awakeTimeout.ts`), not wall time. Amplify compute
// freezes the process between requests, and a wall-clock 800 ms armed by a
// background refresh fired on thaw before the fetch could resume: 33 of 40
// aborts on three live sites (2026-09-16) were logged 1 to 194 ms into the
// next invocation. The bound still holds for a cold-cache request, which is
// awake the whole time it waits.
const FETCH_TIMEOUT_MS = 800;

// Negative-cache window (review pass 1 hardening note): on SUSTAINED
// upstream failure `cache` never populates, so without this every document
// request on every site would re-enter fetchSiteMap() and block up to
// FETCH_TIMEOUT_MS. Skipping the network call within this window after the
// last failure restores the plan's stated property that only the FIRST
// request per instance (per failure window) can ever block.
const NEGATIVE_CACHE_MS = 30_000;

// Hard ceiling, in WALL-CLOCK ms, on how long any one request may block on the
// cold-cache branch of getEdgeSiteMap(), and the age at which a cold in-flight
// fetch is abandoned outright.
//
// This is the fix for the help.vivreal.io outage
// (docs/projects/portal-changes-2026-09-16/help-site-504.md, 2026-09-17).
// Before it, the cold branch returned the shared `inFlight` promise bare, and
// `inFlight` was cleared only in `.finally()`. A fetch that neither completed
// nor aborted was therefore handed to EVERY later request on that instance, so
// one stuck fetch took every page URL on the site to a 28s Amplify origin
// timeout permanently, while `/robots.txt`, `/api/*` and every other
// isSkippablePath() URL kept serving normally. The site was down for five days
// and a redeploy bought 3.5 minutes.
//
// WALL clock, not awake time, and applied only on the blocking branch. A
// cold-cache caller is awake for every millisecond it waits (nothing is served
// until it answers), so the two clocks are the same thing there. A BACKGROUND
// refresh is the opposite case and is deliberately left alone: it can
// legitimately span a Lambda freeze, which is exactly what `./awakeTimeout.ts`
// exists to tolerate, and no visitor is blocked on it.
//
// 1500 sits above FETCH_TIMEOUT_MS (800 awake ms, which also covers
// fetchWithReconnect's retries) so the ordinary abort still wins on a healthy
// instance, and far below Amplify's 28s origin timeout. Exceeding it costs one
// request its authored-redirect resolution and nothing else; see the
// `if (!siteMap)` fall-through in middleware.ts.
export const COLD_FETCH_DEADLINE_MS = 1_500;

/**
 * The stable discriminator VR_Client_API sends for a billing freeze
 * (`CustomError('GroupFrozen')` -> `errorHandler` -> the `code` field on the
 * error envelope).
 *
 * Gate on THIS, never on the human `error` sentence and never on the status
 * alone:
 *  - the status cannot discriminate, because `GroupFrozen` and
 *    `IntegrationNotActive` are BOTH 400;
 *  - and matching the sentence would mean a copy edit silently un-freezes
 *    every frozen site in the fleet.
 *
 * That second one is not hypothetical, and the example below is the receipt.
 * VR_Client_API used to send "The group is frozen please resume go to portal
 * to activate". It now sends something else, and it is EXPECTED to change
 * again: it is customer-facing copy, so it belongs to whoever is editing the
 * voice that week. Because nothing here reads it, that reword froze exactly as
 * many sites as before and cost this file nothing.
 *
 * Both sentences above are quoted as HISTORY, never as a contract. The
 * contract is the code. If you find yourself updating a sentence in this file
 * to keep it current, something has started depending on it and that is the
 * bug.
 *
 * Note it is 400, NOT 402. 402 is the quota / spending-cap path
 * (`handlers.js`), which is a different state with different copy.
 */
const FROZEN_CODE = 'GroupFrozen';

/**
 * How long an observed frozen verdict stays trusted without reconfirmation.
 *
 * This is a FAIL-OPEN timer, and that is its whole point. If the upstream
 * becomes unreachable while a site is frozen, `fetchSiteMap` returns null
 * without touching `frozenState`, the verdict ages out, and the site starts
 * serving again. Never taking a paying customer's site down because the API
 * blinked matters more than holding a freeze through an outage.
 *
 * 90s is three times the NEGATIVE_CACHE_MS recheck cadence, so a reachable
 * upstream refreshes the verdict roughly three times before it could expire.
 */
const FROZEN_SIGNAL_TTL_MS = 90_000;

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
// Wall-clock start of `inFlight`. The cold branch enforces ONE absolute
// deadline across every caller sharing that promise, rather than giving each
// caller a fresh countdown of its own (which would let a late arrival wait
// COLD_FETCH_DEADLINE_MS past a deadline that had already blown).
let inFlightStartedAt = 0;
// Abort handle for `inFlight`, so abandoning it also releases the socket
// instead of leaving a doomed request running against an upstream that is
// already struggling.
let inFlightAbort: AbortController | null = null;
// Bumped once per fetch. Abandonment makes two fetches able to overlap for the
// first time, so a straggler must be stopped from overwriting a newer answer.
let fetchGeneration = 0;
// Negative cache: timestamp of the most recent fetchSiteMap() failure, or
// null if the last attempt succeeded (or none has run yet).
let lastFailureAt: number | null = null;
// Billing-freeze verdict, carried on the SAME siteDetails fetch the redirect
// map already makes. Riding that fetch is the entire reason this is cheap:
// the gate adds no request, no timeout and no blocking to a path that runs on
// every document request of every site.
//
// `null` means "never observed", which reads as NOT frozen. Absence is always
// the open state here.
let frozenState: { frozen: boolean; observedAt: number } | null = null;

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

/**
 * Read a billing-freeze verdict off a non-2xx siteDetails response.
 *
 * FAIL-OPEN IN EVERY BRANCH, and that is deliberate. A false positive here
 * takes a PAYING customer's site down and shows their visitors an "unavailable"
 * page, which is far worse than a frozen site serving for another minute. So
 * this only ever sets `frozen: true` on the one unambiguous signal (a 400
 * carrying the exact `GroupFrozen` code) and otherwise leaves `frozenState`
 * untouched, letting the existing verdict stand or age out on its own.
 *
 * Leaving it untouched rather than clearing it also matters: a transient 500
 * in the middle of a real freeze must not un-freeze the site.
 *
 * Never throws. A throw out of here reaches `fetchSiteMap`'s catch, but this
 * runs on every document request of every site, so it is guarded at its own
 * level too.
 */
async function recordFrozenVerdictFromError(res: Response): Promise<void> {
  // Only a 400 can be a freeze. Checking first avoids reading a body on every
  // unrelated 500 or 401.
  if (res.status !== 400) return;
  try {
    const body = (await res.json()) as { code?: unknown } | null;
    if (body?.code === FROZEN_CODE) {
      frozenState = { frozen: true, observedAt: Date.now() };
    }
  } catch {
    // Unreadable or non-JSON body. Cannot confirm a freeze, so do not claim
    // one.
  }
}

/**
 * Is this site's owner account currently frozen?
 *
 * A PURE READ of the verdict `getEdgeSiteMap()` refreshes as a side effect of
 * the fetch it already makes. It performs no network call and never blocks, so
 * `middleware.ts` can consult it on every request for free.
 *
 * Returns false unless a freeze was positively observed AND that observation
 * is still fresh. Both "never observed" and "observed too long ago" read as
 * not frozen, because every ambiguous state on this path must fail open.
 *
 * DETECTION LATENCY, stated plainly: up to `TTL_MS` (300s). While the redirect
 * map is fresh, `getEdgeSiteMap()` returns early without fetching, so a freeze
 * that begins in that window is not seen until the map goes stale. That is an
 * accepted tradeoff, not an oversight: the alternative is a fetch every 30s on
 * every healthy site in the fleet, which is real load on the exact upstream
 * whose saturation prompted this work. It is also not the binding constraint,
 * because CloudFront can still be serving the pre-freeze page for up to an
 * hour regardless (there is no invalidation API for an Amplify-managed
 * distribution). Once a freeze IS observed the map stops refreshing, so the
 * negative-cache path rechecks every 30s and UNFREEZING is fast, which is the
 * direction the customer is actually waiting on.
 */
export function isSiteFrozen(): boolean {
  if (!frozenState || !frozenState.frozen) return false;
  return Date.now() - frozenState.observedAt < FROZEN_SIGNAL_TTL_MS;
}

/**
 * One read of the upstream site map.
 *
 * `controller` is owned by the CALLER (`startRefresh`) rather than created
 * here, so there are two independent ways to stop this fetch: the awake-time
 * budget below, and `abandonInFlight()` when a caller's wall-clock deadline
 * blows. Before the deadline existed there was only the awake timer, and a
 * fetch it failed to stop was unstoppable.
 *
 * Total by construction: it returns `null` for every failure and never throws.
 * `getEdgeSiteMap()` is awaited directly by middleware on a cold instance, so
 * a throw escaping here would 500 every route on the site.
 */
async function fetchSiteMap(controller: AbortController): Promise<EdgeSiteMap | null> {
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

  const timeout = startAwakeTimeout(FETCH_TIMEOUT_MS, () => controller.abort());
  try {
    // A pooled socket that died while the process was frozen fails fast;
    // `fetchWithReconnect` tries a fresh connection inside the same budget.
    const res = await fetchWithReconnect(
      `${CLIENT_API_URL}/tenant/siteDetails?siteId=${encodeURIComponent(siteId)}`,
      {
        headers: { Authorization: apiKey },
        signal: controller.signal,
        cache: 'no-store',
      },
      {
        onRetry: (err, retry) =>
          console.warn(`[edgeSiteMap] connection failed (${describeNetworkError(err)}), retry ${retry}`),
      },
    );
    if (!res.ok) {
      // Deliberate fail-open (matches clientFetchSafe's posture,
      // src/lib/api/client.ts:170-176): an upstream error here must never
      // take the whole request down. Log for visibility; the caller falls
      // back to the last-known cached value, or null if there is none.
      console.error(`[edgeSiteMap] ${res.status} ${res.statusText} fetching siteDetails`);
      await recordFrozenVerdictFromError(res);
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
    // A 2xx is a definitive NOT-frozen verdict, and recording it here is what
    // makes unfreezing fast: the first successful read after the owner fixes
    // their billing clears the gate on this instance immediately, with no
    // separate signal and no webhook required.
    frozenState = { frozen: false, observedAt: Date.now() };
    return { slugs, redirects };
  } catch (err) {
    // Deliberate fail-open: a network error that survived the reconnect
    // retries, the 800ms awake-time abort, or a malformed body must never
    // throw out of middleware — a throw there
    // takes the whole request down on EVERY route. Log and fall back.
    console.error('[edgeSiteMap] fetch failed, failing open:', err);
    return null;
  } finally {
    timeout.cancel();
  }
}

/**
 * Arm the one shared refresh, and return it.
 *
 * Synchronous: `inFlight`, `inFlightStartedAt` and `inFlightAbort` are all set
 * before this returns, so a caller can rely on the module state immediately.
 */
function startRefresh(now: number): Promise<EdgeSiteMap | null> {
  const controller = new AbortController();
  const generation = (fetchGeneration += 1);
  const promise: Promise<EdgeSiteMap | null> = fetchSiteMap(controller)
    .then((value) => {
      // Only the most recently STARTED fetch may write shared state. Before
      // abandonment existed there could only ever be one fetch at a time, so
      // this was implicit; an abandoned fetch can now settle after a newer one
      // has already answered, and must not overwrite it with older data.
      if (generation !== fetchGeneration) return value;
      if (value) {
        cache = { value, fetchedAt: Date.now() };
        lastFailureAt = null;
      } else {
        lastFailureAt = Date.now();
      }
      return value;
    })
    .catch((err) => {
      // Unreachable today: fetchSiteMap() catches every failure and returns
      // null. It stays because middleware awaits this promise DIRECTLY on a
      // cold instance, so a rejection escaping here throws out of middleware
      // and 500s every route on the site, which is the precise failure this
      // whole module is built to avoid.
      console.error('[edgeSiteMap] in-flight refresh rejected, failing open:', err);
      if (generation === fetchGeneration) lastFailureAt = Date.now();
      return null;
    })
    .finally(() => {
      // Guarded: an abandoned fetch settling late must not clear a NEWER
      // in-flight promise that has since replaced it.
      if (inFlight === promise) {
        inFlight = null;
        inFlightAbort = null;
      }
    });
  inFlight = promise;
  inFlightStartedAt = now;
  inFlightAbort = controller;
  return promise;
}

/**
 * Give up on the shared in-flight fetch.
 *
 * This is the line the help.vivreal.io outage turned on. `inFlight` used to be
 * cleared ONLY by `.finally()`, so a promise that never settled was handed to
 * every subsequent request on the instance forever. Clearing it here means the
 * worst a stuck fetch can do is cost ONE request its deadline.
 *
 * No-op unless `pending` is still the current promise, so a caller whose
 * deadline blew after someone else already replaced it cannot clobber the
 * replacement.
 */
function abandonInFlight(pending: Promise<EdgeSiteMap | null>): void {
  if (inFlight !== pending) return;
  // Release the socket too. A fetch nobody is waiting on must not keep running
  // against the upstream whose slowness caused this.
  inFlightAbort?.abort();
  inFlight = null;
  inFlightAbort = null;
  // Count it as a failure so the negative cache absorbs the next
  // NEGATIVE_CACHE_MS. Without this, request 2 would immediately start another
  // fetch against the same sick upstream and pay the same deadline, turning
  // one slow request into a slow request for every visitor.
  lastFailureAt = Date.now();
}

/** Sentinel: the deadline, not the fetch, won the race in `awaitWithDeadline`. */
const DEADLINE_EXPIRED = Symbol('edgeSiteMap.deadlineExpired');

/**
 * Await `pending`, but never past `deadlineMs`.
 *
 * On expiry it abandons the shared fetch and degrades to the last-known value,
 * or `null`. `middleware.ts` already treats `null` as "fall through, do
 * nothing", so the degrade is a behaviour that is documented and tested there
 * rather than a new failure mode.
 *
 * A one-shot `setTimeout` is the whole of the timer dependency here, and it is
 * deliberately NOT the awake-time interval in `./awakeTimeout.ts`: that one has
 * to accumulate eight 100ms ticks to reach its 800ms budget, and its own header
 * documents that it "runs somewhat long" whenever the event loop is busy. That
 * is the right tradeoff for a background refresh and the wrong one for the
 * branch a visitor is blocked on. Nothing can bound its own await without a
 * timer of some kind; the timer-FREE half of the ceiling is the `Date.now()`
 * check in `getEdgeSiteMap()`, which protects every request after the first.
 */
async function awaitWithDeadline(
  pending: Promise<EdgeSiteMap | null>,
  deadlineMs: number,
): Promise<EdgeSiteMap | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof DEADLINE_EXPIRED>((resolve) => {
    timer = setTimeout(() => resolve(DEADLINE_EXPIRED), deadlineMs);
  });
  try {
    const winner = await Promise.race([pending, deadline]);
    if (winner !== DEADLINE_EXPIRED) return winner;
    console.error(`[edgeSiteMap] cold read exceeded ${deadlineMs}ms, falling through`);
    abandonInFlight(pending);
    return cache ? cache.value : null;
  } finally {
    clearTimeout(timer);
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
 *   every concurrent caller observes `cache === null` and waits on the shared,
 *   deduped promise, but only until ONE absolute deadline,
 *   `inFlightStartedAt + COLD_FETCH_DEADLINE_MS`, shared by all of them. Past
 *   that the fetch is abandoned and aborted and the call degrades to `null`.
 *   Only a warm cache (fresh or stale) ever avoids waiting at all.
 * - Any failure: returns the last-known value, or `null` if there is none.
 *   `middleware.ts` treats `null` as "fall through, do nothing" — never as
 *   an error to propagate.
 * - Negative cache: within NEGATIVE_CACHE_MS of the last failure (a blown
 *   deadline counts as one), skips the network call entirely and returns the
 *   last-known value, or `null`, rather than re-attempting and re-blocking.
 *
 * The property the whole file exists to hold, stated once: NO request may
 * inherit another request's stuck promise, and no request may block past the
 * deadline. One stuck fetch costs at most one slow request per
 * NEGATIVE_CACHE_MS window; it can never take the instance down.
 */
export async function getEdgeSiteMap(): Promise<EdgeSiteMap | null> {
  const now = Date.now();

  if (cache && now - cache.fetchedAt < TTL_MS) {
    return cache.value;
  }

  // THE TIMER-FREE CEILING. A plain clock comparison, so this holds even if no
  // timer in the middleware sandbox ever fires.
  //
  // Scoped to `!cache` on purpose: that is exactly the state in which a caller
  // BLOCKS on `inFlight` (every warm caller returns `cache.value` below without
  // awaiting it), and a cold caller is awake for the whole wait, so wall clock
  // is the right clock. A background refresh is never abandoned here, because
  // it can legitimately span a Lambda freeze and be minutes old in wall clock
  // while having had almost no awake time. Abandoning those would undo the
  // 2026-09-16 awake-timeout fix and stop quiet sites refreshing at all.
  if (!cache && inFlight && now - inFlightStartedAt >= COLD_FETCH_DEADLINE_MS) {
    abandonInFlight(inFlight);
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

  const pending = inFlight ?? startRefresh(now);

  if (cache) {
    // Stale-while-revalidate: serve the stale value now. The in-flight
    // refresh's `.then` above updates `cache` for the NEXT call once it
    // resolves — this call does not await it.
    return cache.value;
  }

  // Cold cache: this call (and every concurrent call sharing `pending`) does
  // have to wait for the network, but only until the shared absolute deadline.
  // The subtraction is positive here: a `pending` older than that was already
  // abandoned above, and a `pending` created by startRefresh() started at `now`.
  return awaitWithDeadline(pending, inFlightStartedAt + COLD_FETCH_DEADLINE_MS - now);
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
  inFlightStartedAt = 0;
  inFlightAbort = null;
  lastFailureAt = null;
  frozenState = null;
  // Bump the generation too, so a never-settling fetch left behind by an
  // earlier case cannot write into the next one if it ever does settle.
  fetchGeneration += 1;
}

/**
 * Test-only escape hatch: rewinds the frozen verdict's `observedAt` so the
 * next `isSiteFrozen()` treats it as expired, without waiting out the real
 * 90s TTL. Makes the fail-open-on-staleness branch reachable in a fast unit
 * test. No-op if nothing has been observed. Never called from `middleware.ts`
 * or any production path.
 */
export function __setFrozenObservedAtForTests(observedAt: number): void {
  if (frozenState) {
    frozenState = { frozen: frozenState.frozen, observedAt };
  }
}

/**
 * Test-only escape hatch: rewinds the negative-cache timestamp so the next
 * `getEdgeSiteMap()` actually hits the network again, without waiting out the
 * real NEGATIVE_CACHE_MS.
 *
 * Needed to test UNFREEZING. A freeze leaves `cache` empty and `lastFailureAt`
 * fresh, so the very next call short-circuits before `fetch` and the verdict
 * cannot change in-process. That 30s recheck cadence is the real production
 * behaviour and the reason unfreezing takes up to ~30s to be seen; this hook
 * lets a fast test cross that window. Never called from `middleware.ts` or any
 * production path.
 */
export function __setLastFailureAtForTests(at: number | null): void {
  lastFailureAt = at;
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
