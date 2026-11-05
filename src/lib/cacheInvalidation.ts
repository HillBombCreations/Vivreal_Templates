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
 *  - Any failure (an error, the timeout, a 4xx or 5xx, an answer that is not
 *    this site's version) forgets the version, so the shell read is the
 *    unversioned one, byte for byte today's. A Client without CL7 answers
 *    404, so before CL7 ships every read is today's.
 *  - Concurrent requests share one probe; a burst never multiplies it.
 *
 * Pure: the probe, the clock and the timer are injected, so `node --test`
 * drives two "instances" over one fake Client (cacheInvalidation.fence.test.ts).
 */

/** At most one probe per this many milliseconds per instance (OD-01). */
export const SITE_VERSION_INTERVAL_MS = 5_000;

/** A probe that has not answered in this much awake time is a failure. */
export const SITE_VERSION_TIMEOUT_MS = 500;

/** CL7's own path, built in one place. */
export function siteVersionPath(siteId: string): string {
  return `/tenant/siteVersion?siteId=${encodeURIComponent(siteId)}`;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * The version in a CL7 answer (the envelope's `data`), or null when it is not
 * this site's or not an ISO instant. A site stored without `updatedAt`
 * answers null, which reads as "no version": today's read.
 */
export function readSiteVersion(data: unknown, siteId: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { siteId: answered, updatedAt } = data as { siteId?: unknown; updatedAt?: unknown };
  if (answered !== siteId) return null;
  return typeof updatedAt === 'string' && ISO_INSTANT.test(updatedAt) ? updatedAt : null;
}

/** The shell read's path with the version on it, or the path as given when there is none. */
export function versionedPath(path: string, version: string | null): string {
  if (!version) return path;
  return `${path}${path.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
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
  /** One line per probe that failed; the read itself goes on as today. */
  readonly onFailure?: (reason: string) => void;
}

export interface SiteVersionFence {
  /**
   * The version the shell read of THIS render carries, or null for today's
   * unversioned read. `serving` is `isOrdinaryPageRender` for this render.
   */
  versionFor(serving: boolean): Promise<string | null>;
}

export function createSiteVersionFence(deps: SiteVersionFenceDeps): SiteVersionFence {
  const intervalMs = deps.intervalMs ?? SITE_VERSION_INTERVAL_MS;
  const timeoutMs = deps.timeoutMs ?? SITE_VERSION_TIMEOUT_MS;
  let lastSeen: string | null = null;
  let probedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<void> | null = null;

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
        lastSeen = null;
        deps.onFailure?.('timeout');
        return;
      }
      const version = readSiteVersion(answer, deps.siteId);
      lastSeen = version;
      if (!version) deps.onFailure?.('no_version');
    } catch (err) {
      // An error, a 4xx or a 5xx: forget the version, so the read is today's.
      lastSeen = null;
      deps.onFailure?.(err instanceof Error ? err.message : 'error');
    } finally {
      timer?.cancel();
    }
  };

  return {
    async versionFor(serving: boolean): Promise<string | null> {
      if (!serving || !deps.siteId) return null;
      if (!inFlight && deps.now() - probedAt >= intervalMs) {
        probedAt = deps.now();
        inFlight = runProbe().finally(() => {
          inFlight = null;
        });
      }
      if (inFlight) await inFlight;
      return lastSeen;
    },
  };
}
