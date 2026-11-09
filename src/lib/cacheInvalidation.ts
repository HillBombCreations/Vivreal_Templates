/**
 * Cache-invalidation profile used by the Studio-edit webhook
 * (`POST /api/revalidate`).
 *
 * Next 16's `revalidateTag(tag, profile)` takes either a named `cacheLife`
 * profile or an inline `{ expire }` object, and the two behave very
 * differently against the tag manifest:
 *
 *   'max'         -> writes { stale: now, expired: now + 365d }. The read-side
 *                    predicate `areTagsExpired()` requires `expired <= now`, so
 *                    the entry is NEVER dropped: it is served stale one more
 *                    time and repaired by a best-effort background refetch.
 *   { expire: 0 } -> writes { stale: now, expired: now }, which DOES satisfy
 *                    `areTagsExpired()`. The entry is dropped and the very next
 *                    render refetches.
 *
 * A customer who just saved an edit must not be served the pre-edit bytes even
 * once, so this site uses the hard form.
 *
 * This lives in its own module, rather than inline in the route, so the
 * behaviour can be proven by CALLING Next's real revalidation path in
 * cacheInvalidation.test.ts. `route.ts` imports `next/server` and cannot be
 * loaded by `node --experimental-strip-types`, and a source-regex assertion on
 * the literal `{ expire: 0 }` would prove nothing about what Next does with it.
 *
 * SCOPE: this repairs the invalidation on the Amplify compute instance that
 * receives the webhook. It cannot reach the OTHER instances serving the same
 * site, because the tag manifest is a per-process Map. For the site shell on
 * ordinary pages that window is now closed by the site version fence below
 * (F41); everywhere else it is still bounded by SITE_CACHE_TTL_SECONDS.
 */
export const HARD_INVALIDATION = { expire: 0 } as const;

/**
 * The site version fence (F41, owner decision OD-01, 2026-11-05: "ordinary
 * pages check a tiny 'has this site changed' marker and refresh straight
 * away; the home and pricing pages keep their current timing").
 *
 * WHAT WAS WRONG. A Studio save reaches ONE compute instance of a live site
 * (the revalidate webhook). Every other instance kept rendering its own copy
 * of the site shell for up to `SITE_CACHE_TTL_SECONDS`, and the instance the
 * webhook did reach could refetch through a client.vivreal.io edge copy from
 * before the save and cache THAT for a fresh window. So a new page answered
 * "Not Found" on some visits for minutes (vivreal-hq
 * docs/bugs/f41-stale-pages-after-save/research.md).
 *
 * THE FENCE. While serving an ordinary page, an instance asks VR_Client_API
 * `GET /tenant/siteVersion` (CL7: `{ siteId, updatedAt }`, never cached,
 * never billed) at most once per `SITE_VERSION_INTERVAL_MS`, giving it
 * `SITE_VERSION_TIMEOUT_MS`. The shell read then carries `&v=<updatedAt>`:
 * a save is a NEW Next data-cache key on every instance and a NEW edge key
 * at client.vivreal.io (every query string is in its cache key), so the next
 * ordinary page on any instance reads the saved site. That new key is this
 * instance's purge of the shell: Next refuses `revalidateTag` during a render
 * (`createRevalidateDuringRenderError`, next 16.4.1
 * `server/web/spec-extension/revalidate.js`), and the key change needs none.
 *
 * WHAT IT NEVER DOES.
 *  - It never runs outside a request render of an ordinary page
 *    (`isOrdinaryPageRender`): not at build, not in a regeneration of a page
 *    served from the page cache, not on the home page, not in a route
 *    handler. Those read the shell exactly as before.
 *  - A failed or slow probe never takes an instance back to an older site
 *    than it has served (RW-4, vivreal-hq rewalk-2026-11-defects.md). The
 *    instance keeps the newest version it knows, and moves only forward: once
 *    a version is known, no ordinary page reads the unversioned shell again.
 *    Until 2026-11-09 a failure forgot the version, so the read fell back to
 *    the unversioned key, which still held the shell from before the save: a
 *    page that already showed the save flipped back to the old words, and a
 *    new page answered 404 again. See `readShell` for what each read does.
 *  - Concurrent requests share one probe; a burst never multiplies it.
 *
 * Pure: the probe, the clock and the timer are injected, so `node --test`
 * drives two "instances" over one fake Client (cacheInvalidation.fence.test.ts).
 */

/** At most one probe per this many milliseconds per instance (OD-01). */
export const SITE_VERSION_INTERVAL_MS = 5_000;

/**
 * A probe that has not answered in this much awake time is a failure.
 *
 * Warm: the RW-4 walk measured the Client answering in 250 to 483 ms and the
 * probe taking 524 to 566 ms end to end, against the 500 that was here, so
 * every probe failed. That Client ran from source against Atlas over the
 * internet, slower than a warm Lambda, so 1500 holds a warm Client about three
 * times over. Cold: a Client cold start takes seconds and still times out,
 * which is now safe (the known version is kept, or the first read is fresh).
 * Render budget: the probe holds at most one render per instance per
 * `SITE_VERSION_INTERVAL_MS` (concurrent renders join it, later ones inside
 * the interval skip it), and 1500 is the bound the middleware already accepts
 * for a visitor's first site map lookup against the same Client
 * (`COLD_FETCH_DEADLINE_MS`, `./edgeSiteMap.ts`), far under Amplify's 28 s
 * origin timeout.
 */
export const SITE_VERSION_TIMEOUT_MS = 1_500;

/** CL7's own path, built in one place. */
export function siteVersionPath(siteId: string): string {
  return `/tenant/siteVersion?siteId=${encodeURIComponent(siteId)}`;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * The version in a CL7 answer (the envelope's `data`), or null when it is not
 * this site's or not an ISO instant. A site stored without `updatedAt`
 * answers null, which reads as "no version": the plain read while nothing is
 * known (`answersNoVersion`).
 */
export function readSiteVersion(data: unknown, siteId: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { siteId: answered, updatedAt } = data as { siteId?: unknown; updatedAt?: unknown };
  if (answered !== siteId) return null;
  return typeof updatedAt === 'string' && ISO_INSTANT.test(updatedAt) ? updatedAt : null;
}

/**
 * Whether a CL7 answer is this site's, stored with no `updatedAt`: a real
 * "this site has no version", unlike another site's id or a value that is not
 * an instant, which are failures.
 */
function answersNoVersion(data: unknown, siteId: string): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const { siteId: answered, updatedAt } = data as { siteId?: unknown; updatedAt?: unknown }; // both read as unknown and checked here
  return answered === siteId && (updatedAt === null || updatedAt === undefined);
}

/** The shell read's path with the version on it, or the path as given when there is none. */
export function versionedPath(path: string, version: string | null): string {
  if (!version) return path;
  return `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

/** Whether `a` is a later instant than `b` (both pass `ISO_INSTANT`). */
function isLater(a: string, b: string): boolean {
  return Date.parse(a) > Date.parse(b);
}

/**
 * What one render's shell read is (RW-4).
 *  - `plain`: the unversioned read, exactly as before the fence. Only for a
 *    render that is not an ordinary page served per request, or while nothing
 *    is known and the Client answered that the site has no version (a site
 *    with no `updatedAt` gives the fence nothing to key on, so its reads stay
 *    as before the fence; reading fresh for it would skip every cache on every
 *    page).
 *  - `versioned`: the newest version this instance knows, kept across failed
 *    and slow probes.
 *  - `fresh`: nothing is known yet and the probe failed or was slow.
 */
export type ShellRead =
  | { readonly kind: 'plain' }
  | { readonly kind: 'versioned'; readonly version: string }
  | { readonly kind: 'fresh' };

const PLAIN_READ: ShellRead = Object.freeze({ kind: 'plain' });
const FRESH_READ: ShellRead = Object.freeze({ kind: 'fresh' });

/** The two shell reads a render can make. */
export interface ShellReads<T> {
  /** The cached read of this path: the Next data cache, then client.vivreal.io. */
  readonly cached: (path: string) => Promise<T>;
  /**
   * A read no cache can answer from before it began: past the data cache, and
   * keyed at the edge by its own start instant (`clientFetchCached`'s
   * `fresh`). Only ever made in a request render of an ordinary page, the one
   * place an uncached fetch cannot turn a cached page dynamic.
   */
  readonly fresh: () => Promise<T>;
}

/**
 * This render's site shell, by the fence's answer (RW-4):
 *  - plain: the cached plain read, as before the fence.
 *  - versioned: the cached read of that version. If it does not come back live
 *    (its key is not cached here and the Client failed), a fresh read, never
 *    the plain key, which can hold the site from before a save this instance
 *    has already served. If that fails too, the floor the seam answered (a
 *    floor value refuses every "not found").
 *  - fresh: a fresh read, so a first read never takes a plain copy from before
 *    the stored site. Its `updatedAt` becomes the known version, so the next
 *    render reads that version through the caches instead of another fresh
 *    read. Only when the fresh read fails too (the Client answered neither the
 *    probe nor the read, so nothing newer can be had) does it take the plain
 *    read: today's outage answer, never older than the build floor, and the
 *    one read a Client that refuses `v` still answers (review N4).
 */
export async function readShell<T extends { readonly updatedAt?: unknown } | null | undefined>(
  fence: SiteVersionFence,
  serving: boolean,
  reads: ShellReads<T>,
  path: string,
  isLive: (value: T) => boolean,
): Promise<T> {
  const plan = await fence.shellReadFor(serving);
  if (plan.kind === 'plain') return reads.cached(path);
  if (plan.kind === 'versioned') {
    const versioned = await reads.cached(versionedPath(path, plan.version));
    if (isLive(versioned)) return versioned;
  }
  const fresh = await reads.fresh();
  if (isLive(fresh)) {
    fence.learn(fresh?.updatedAt);
    return fresh;
  }
  return plan.kind === 'fresh' ? reads.cached(path) : fresh;
}

/**
 * Whether this render serves an ordinary page per request, from Next's two
 * work stores (the same internals `queryReadGate.ts` reads, pinned by
 * `next ~16.4.1`): a request render (`type === 'request'`; a regeneration of a
 * cached page and a build prerender are other types) of a page module
 * (`/…/page`) that is not the home page (`/page`). Route handlers end in
 * `/route`. Anything unreadable answers false: today's read.
 */
export function isOrdinaryPageRender(
  unitStore: { type?: unknown } | undefined,
  workStore: { page?: unknown } | undefined,
): boolean {
  if (unitStore?.type !== 'request') return false;
  const page = workStore?.page;
  return typeof page === 'string' && page.endsWith('/page') && page !== '/page';
}

export interface SiteVersionFenceDeps {
  readonly siteId: string;
  /** CL7's `data`, or a throw for any failure. Aborted by `signal` on the timeout. */
  readonly probe: (signal: AbortSignal) => Promise<unknown>;
  readonly now: () => number;
  /** An awake-time timer (`startAwakeTimeout`), so a frozen instance never times out on thaw. */
  readonly startTimeout: (ms: number, onExpire: () => void) => { cancel(): void };
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  /** One line per probe that failed; the read itself goes on (see `readShell`). */
  readonly onFailure?: (reason: string) => void;
}

export interface SiteVersionFence {
  /** What THIS render's shell read is. `serving` is `isOrdinaryPageRender` for this render. */
  shellReadFor(serving: boolean): Promise<ShellRead>;
  /**
   * A version read off a live fresh shell (its `updatedAt`, the same instant
   * CL7 answers). Moves the known version forward only; anything that is not
   * an ISO instant is ignored.
   */
  learn(version: unknown): void;
}

export function createSiteVersionFence(deps: SiteVersionFenceDeps): SiteVersionFence {
  const intervalMs = deps.intervalMs ?? SITE_VERSION_INTERVAL_MS;
  const timeoutMs = deps.timeoutMs ?? SITE_VERSION_TIMEOUT_MS;
  // The newest version this instance has seen. Never cleared and never moved
  // back (RW-4): a failed probe leaves it, and an older answer (a lagging
  // read) does not replace it.
  let known: string | null = null;
  // Only read while nothing is known: whether the last probe answered "this
  // site has no version" (a plain read) or failed (a fresh read).
  let unversioned = false;
  let probedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<void> | null = null;

  const moveForward = (version: string): void => {
    if (known === null || isLater(version, known)) known = version;
  };

  const runProbe = async (): Promise<void> => {
    const controller = new AbortController();
    let timer: { cancel(): void } | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = deps.startTimeout(timeoutMs, () => {
        controller.abort();
        resolve('timeout');
      });
    });
    try {
      // Raced, not trusted to the abort alone: a transport that ignores the
      // signal still cannot hold the page past the budget.
      const answer = await Promise.race([deps.probe(controller.signal), timedOut]);
      if (answer === 'timeout') {
        unversioned = false;
        deps.onFailure?.('timeout');
        return;
      }
      const version = readSiteVersion(answer, deps.siteId);
      if (version) {
        moveForward(version);
        return;
      }
      unversioned = answersNoVersion(answer, deps.siteId);
      deps.onFailure?.('no_version');
    } catch (err) {
      // An error, a 4xx or a 5xx: the known version stays (RW-4).
      unversioned = false;
      deps.onFailure?.(err instanceof Error ? err.message : 'error');
    } finally {
      timer?.cancel();
    }
  };

  return {
    async shellReadFor(serving: boolean): Promise<ShellRead> {
      if (!serving || !deps.siteId) return PLAIN_READ;
      if (!inFlight && deps.now() - probedAt >= intervalMs) {
        probedAt = deps.now();
        inFlight = runProbe().finally(() => {
          inFlight = null;
        });
      }
      if (inFlight) await inFlight;
      if (known !== null) return { kind: 'versioned', version: known };
      return unversioned ? PLAIN_READ : FRESH_READ;
    },
    learn(version: unknown): void {
      if (typeof version === 'string' && ISO_INSTANT.test(version)) moveForward(version);
    },
  };
}
