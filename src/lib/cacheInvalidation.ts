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
 * site, because the tag manifest is a per-process Map. For the site shell that
 * window is now closed by the site version fence below (F41), which every
 * shell reader goes through; other reads are still bounded by
 * SITE_CACHE_TTL_SECONDS.
 */
export const HARD_INVALIDATION = { expire: 0 } as const;

/**
 * The site version fence (F41, owner decision OD-01, 2026-11-05), as ONE read
 * state machine for every shell reader (RW-4). The design, with its
 * invariants I1 to I9, its transitions table and its mutation map, is vivreal-hq
 * docs/projects/release-plan-open-backlog/design-t2-fence-state.md (revision 3).
 * This comment names the parts; the design is the spec.
 *
 * WHY. A Studio save reaches ONE compute instance (the revalidate webhook).
 * Every other instance kept its copy of the shell for up to the cache TTL, and
 * the edge copy at client.vivreal.io lives 60 s. The fence asks VR_Client_API
 * `GET /tenant/siteVersion` (CL7) for the site's `updatedAt` and reads the
 * shell keyed by it (`&v=<updatedAt>`), so a save is a new data-cache key and a
 * new edge key everywhere. Its state lives for the life of the instance, while
 * the content it names lives in layers with other lifetimes. So when a layer
 * misses, the machine decides, never the reader.
 *
 * STATE (one per process, `../api/siteData/siteVersionFence.ts`):
 *  - `K`, the newest version known; only moves forward.
 *  - `NV`, the site answered "no `updatedAt`" while nothing was known.
 *  - `L`, the newest public live shell served; only moves forward, kept as a
 *    clone and served as a clone.
 *  - the probe slot: at most one probe per `SITE_VERSION_INTERVAL_MS`.
 *
 * READERS (`readerClassFor`): FULL (an ordinary page, a share image, a
 * sitemap, the IndexNow list, each rendered per request) probes and may read
 * fresh; KNOWN (home, any regeneration, every other route) reads `K` with no
 * probe and no uncached call; PLAIN (the build, a preview, no site id) reads
 * as before the fence and learns nothing.
 *
 * ONE RESOLUTION (`resolve`): plan a target (V = the version `K`, F = fresh,
 * Pl = plain), follow the chain V, F, Pl on a non-live answer inside a time
 * budget, choose the newest of the live answers and `L`, mark the answer stale
 * when it may be older than the stored site (a stale shell refuses every
 * negative claim), learn, and log one line when the answer is not the target.
 */

/** At most one probe per this many milliseconds per instance (OD-01). */
export const SITE_VERSION_INTERVAL_MS = 5_000;

/**
 * The probe step's wait, in awake time. A warm Client answers in under 0.9 s
 * (7 days of Client logs: p99 742 ms, slowest `siteDetails` 881 ms); a cold one
 * takes seconds and is a failed probe, which the reads below absorb.
 */
export const SITE_VERSION_TIMEOUT_MS = 1_500;

/** The reads budget after the probe step, awake time, while this instance has served a shell (`L`). */
export const SHELL_READS_BUDGET_MS = 3_000;

/** The reads budget before any shell was served: room for one cold Client (Init max 4.13 s plus 0.88 s). */
export const SHELL_READS_BUDGET_COLD_MS = 5_000;

/** One read's deadline while `L` exists: clears the slowest warm handler (881 ms). */
export const SHELL_READ_DEADLINE_MS = 1_500;

/** One read's deadline before any shell was served: a cold Client still answers. */
export const SHELL_READ_DEADLINE_COLD_MS = 5_000;

/** CL7's own path, built in one place. */
export function siteVersionPath(siteId: string): string {
  return `/tenant/siteVersion?siteId=${encodeURIComponent(siteId)}`;
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * The version in a CL7 answer (the envelope's `data`), or null when it is not
 * this site's or not an ISO instant. A site stored without `updatedAt`
 * answers null, which reads as "no version" (`answersNoVersion`).
 */
export function readSiteVersion(data: unknown, siteId: string): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { siteId: answered, updatedAt } = data as { siteId?: unknown; updatedAt?: unknown }; // both read as unknown and checked here
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
 * A shell's own version (R5 `updatedAt`, the instant CL7 answers): `nv` when the
 * site has none, `u` when it is an ISO instant, neither when it is malformed.
 */
function shellVersion(value: unknown): { u: string | null; nv: boolean } {
  if (typeof value !== 'object' || value === null) return { u: null, nv: false };
  const raw = (value as { updatedAt?: unknown }).updatedAt; // read as unknown and checked here
  if (raw === null || raw === undefined) return { u: null, nv: true };
  return { u: typeof raw === 'string' && ISO_INSTANT.test(raw) ? raw : null, nv: false };
}

/** FULL, KNOWN or PLAIN (design section 6). PLAIN is decided by the caller (build, preview, no site id). */
export type ReaderClass = 'full' | 'known' | 'plain';

/**
 * The readers that probe and may read fresh, by the name Next gives the render
 * (`workStore.page`), only in a request render (`type === 'request'`; a
 * regeneration and a build prerender are other types). Design section 6:
 * OD-01's ordinary pages (`/book` and `/booking/manage` were FULL at the
 * approved base under the "every page but home" rule and stay FULL), and the
 * share image, sitemap and IndexNow routes, which must never lag the page.
 * Each is rendered per request, so a probe or an uncached read there cannot
 * turn a cached response dynamic.
 */
const FULL_READERS: ReadonlySet<string> = new Set([
  '/[slug]/page',
  '/[slug]/[itemId]/page',
  '/[...segments]/page',
  '/book/page',
  '/booking/manage/page',
  '/og/[slug]/route',
  '/og/[slug]/[itemId]/route',
  '/sitemap.xml/route',
  '/sitemaps/[file]/route',
  '/api/indexnow/urls/route',
]);

/**
 * FULL or KNOWN from Next's two work stores (the same internals
 * `queryReadGate.ts` reads, pinned by `next ~16.4.1`). Everything that is not a
 * FULL reader in a request render is KNOWN: home, every regeneration, every
 * other route handler, and anything unreadable. KNOWN only ever reads through
 * the data cache.
 */
export function readerClassFor(
  unitStore: { type?: unknown } | undefined,
  workStore: { page?: unknown } | undefined,
): 'full' | 'known' {
  if (unitStore?.type !== 'request') return 'known';
  const page = workStore?.page;
  return typeof page === 'string' && FULL_READERS.has(page) ? 'full' : 'known';
}

/** V reads the known version, F reads fresh, Pl reads the plain key. */
export type ShellStep = 'V' | 'F' | 'Pl';

/** The shell reads one resolution may make. Each takes the abort signal of its deadline. */
export interface ShellReads<T> {
  /** A data-cache read of `path` (the plain key, or `path&v=<K>`). An aborted signal makes it cache-only. */
  readonly cached: (path: string, signal: AbortSignal) => Promise<T>;
  /**
   * A read no cache can answer from before it began (past the data cache,
   * keyed at the edge by its own start instant). `refused` is true only when
   * the Client refused it with a 4xx (a Client without #137), never for a
   * timeout, a memo short-circuit, a 5xx or a network error (R1).
   */
  readonly fresh: (signal: AbortSignal) => Promise<{ value: T; refused: boolean }>;
  /** The build floor for this path when no read answered at all, else the fallback. */
  readonly floor: () => T;
}

/** What one resolution serves, and whether it may be older than the stored site. */
export interface ShellResolution<T> {
  readonly value: T;
  /** A stale shell refuses every negative claim (a 404, an IndexNow list, an empty sitemap). */
  readonly stale: boolean;
}

/** The probe step's outcome for this render. */
export type ProbeOutcome = 'fresh' | 'slow' | 'failed' | 'skipped';

/** One `site.shell.degraded` line: the answer did not come from the plan's target (I8). */
export interface DegradedShellLine {
  readonly reader: ReaderClass;
  readonly probe: ProbeOutcome;
  readonly target: ShellStep;
  readonly answeredBy: ShellStep | 'L' | 'floor';
  readonly stale: boolean;
  readonly ms: number;
}

export interface SiteVersionFenceDeps {
  readonly siteId: string;
  /** CL7's `data`, or a throw for any failure. Aborted by `signal` on the timeout. */
  readonly probe: (signal: AbortSignal) => Promise<unknown>;
  readonly now: () => number;
  /** An awake-time timer (`startAwakeTimeout`), so a frozen instance never times out on thaw. */
  readonly startTimeout: (ms: number, onExpire: () => void) => { cancel(): void };
  /** An awake-time stopwatch (`startAwakeStopwatch`): the budget's clock. */
  readonly startStopwatch: () => { awakeMs(): number; stop(): void };
  readonly onProbeFailure?: (reason: string) => void;
  readonly onDegraded?: (line: DegradedShellLine) => void;
  /** How `L` is copied in and out (default `structuredClone`): one render's edits never reach another (I9). */
  readonly clone?: <V>(value: V) => V;
}

export interface SiteVersionFence {
  /** One shell resolution for a reader of class `reader` (design section 3). */
  resolve<T>(reader: ReaderClass, reads: ShellReads<T>, path: string, isLive: (value: T) => boolean): Promise<ShellResolution<T>>;
  /** A `site.*` webhook: the next FULL render probes first. Never waits (G5). */
  markProbeDue(): void;
}

const TIMED_OUT: unique symbol = Symbol('shell read timed out');

/** A signal that never aborts: a PLAIN read keeps today's (unbounded) behaviour. */
const NEVER_ABORTED: AbortSignal = new AbortController().signal;

export function createSiteVersionFence(deps: SiteVersionFenceDeps): SiteVersionFence {
  const clone = deps.clone ?? (<V>(value: V): V => structuredClone(value));
  let known: string | null = null;
  let noVersion = false;
  let newest: { u: string; value: unknown } | null = null;
  let probedAt = Number.NEGATIVE_INFINITY;
  let inFlight: Promise<ProbeOutcome> | null = null;

  const moveKnown = (u: string): void => {
    if (known === null || isLater(u, known)) known = u;
  };
  const moveNewest = (u: string, value: unknown): void => {
    if (newest === null || isLater(u, newest.u)) newest = { u, value: clone(value) };
  };

  const runProbe = async (): Promise<ProbeOutcome> => {
    const controller = new AbortController();
    let timer: { cancel(): void } | undefined;
    const timedOut = new Promise<'timeout'>((resolve) => {
      timer = deps.startTimeout(SITE_VERSION_TIMEOUT_MS, () => {
        resolve('timeout');
        controller.abort();
      });
    });
    try {
      // Raced, not trusted to the abort alone: a transport that ignores the
      // signal still cannot hold the render past the probe's wait.
      const answer = await Promise.race([deps.probe(controller.signal), timedOut]);
      if (answer === 'timeout') {
        deps.onProbeFailure?.('timeout');
        return 'slow';
      }
      const version = readSiteVersion(answer, deps.siteId);
      if (version) {
        moveKnown(version);
        noVersion = false;
        return 'fresh';
      }
      if (answersNoVersion(answer, deps.siteId)) {
        if (known === null) noVersion = true;
        return 'fresh';
      }
      deps.onProbeFailure?.('not_this_site_or_not_an_instant');
      return 'failed';
    } catch (err) {
      deps.onProbeFailure?.(err instanceof Error ? err.message : 'error');
      return 'failed';
    } finally {
      timer?.cancel();
    }
  };

  /** Start a probe if one is due, join one in flight, or skip (I5: one per interval per instance). */
  const probeStep = (): Promise<ProbeOutcome> => {
    if (!inFlight && deps.now() - probedAt >= SITE_VERSION_INTERVAL_MS) {
      probedAt = deps.now();
      inFlight = runProbe().finally(() => {
        inFlight = null;
      });
    }
    return inFlight ?? Promise.resolve('skipped');
  };

  /**
   * Learn from one live, public, runtime answer (design step 6). `refused`: F
   * was refused with a 4xx earlier in this resolution.
   */
  const learn = (step: ShellStep, value: unknown, refused: boolean): void => {
    // R3: with nothing known, a plain copy is of unknown age (the build's data
    // cache, an edge copy) and teaches nothing, unless F was refused (no #137).
    if (step === 'Pl' && known === null && !refused) return;
    const { u, nv } = shellVersion(value);
    if (nv) {
      if (known === null) noVersion = true;
      return;
    }
    if (u === null) return;
    // R2: an answer older than K moves L forward, never K.
    if (known !== null && isLater(known, u)) {
      moveNewest(u, value);
      return;
    }
    moveKnown(u);
    moveNewest(u, value);
  };

  return {
    markProbeDue(): void {
      probedAt = Number.NEGATIVE_INFINITY;
    },

    async resolve<T>(reader: ReaderClass, reads: ShellReads<T>, path: string, isLive: (value: T) => boolean): Promise<ShellResolution<T>> {
      if (reader === 'plain' || !deps.siteId) {
        // The build, a preview, no site id: today's read; nothing learned (T21, T22).
        return { value: await reads.cached(path, NEVER_ABORTED), stale: false };
      }
      const clock = deps.startStopwatch();
      try {
        const probe = reader === 'full' ? await probeStep() : 'skipped';
        const planKnown = known;
        const planNoVersion = noVersion;
        const hasNewest = newest !== null;
        const budget = hasNewest ? SHELL_READS_BUDGET_MS : SHELL_READS_BUDGET_COLD_MS;
        const deadline = hasNewest ? SHELL_READ_DEADLINE_MS : SHELL_READ_DEADLINE_COLD_MS;
        const readsFrom = clock.awakeMs();

        /** One read, aborted at min(deadline, budget left); with nothing left it is cache-only. */
        const bounded = async <R>(run: (signal: AbortSignal) => Promise<R>): Promise<R | typeof TIMED_OUT> => {
          const ms = Math.max(0, Math.min(deadline, budget - (clock.awakeMs() - readsFrom)));
          const controller = new AbortController();
          if (ms === 0) controller.abort();
          let timer: { cancel(): void } | undefined;
          const expired = new Promise<typeof TIMED_OUT>((resolve) => {
            timer = deps.startTimeout(ms, () => {
              resolve(TIMED_OUT);
              controller.abort();
            });
          });
          try {
            return await Promise.race([run(controller.signal), expired]);
          } finally {
            timer?.cancel();
          }
        };

        // 1. Plan.
        const target: ShellStep = planKnown !== null ? 'V' : planNoVersion || reader === 'known' ? 'Pl' : 'F';
        const chain: ShellStep[] =
          target === 'V' ? (reader === 'full' ? ['V', 'F', 'Pl'] : ['V', 'Pl']) : target === 'F' ? ['F', 'Pl'] : ['Pl'];

        // 2 and 3. The chain, inside the budget.
        let refused = false;
        let nonLive: T | undefined;
        const lives: Array<{ step: ShellStep; value: T; u: string | null }> = [];
        for (const step of chain) {
          // F is skipped once L already holds K (it could only return what L has).
          if (step === 'F' && known !== null && newest !== null && !isLater(known, newest.u)) continue;
          let value: T | undefined;
          if (step === 'F') {
            const out = await bounded((signal) => reads.fresh(signal));
            if (out !== TIMED_OUT) {
              value = out.value;
              if (out.refused) refused = true;
            }
          } else {
            const out = await bounded((signal) => reads.cached(step === 'V' ? versionedPath(path, planKnown) : path, signal));
            if (out !== TIMED_OUT) value = out;
          }
          if (value === undefined) continue;
          if (!isLive(value)) {
            if (nonLive === undefined || (nonLive === null && value !== null)) nonLive = value;
            continue;
          }
          const before = known;
          const { u } = shellVersion(value);
          learn(step, value, refused);
          lives.push({ step, value, u });
          if (before === null || (u !== null && !isLater(before, u))) break;
        }

        // 4. Choose the newest of the live answers and L; a tie goes to the live answer.
        let best: { step: ShellStep; value: T; u: string | null } | undefined;
        for (const live of lives) {
          if (!best || (live.u !== null && (best.u === null || isLater(live.u, best.u)))) best = live;
        }
        const fromNewest = newest !== null && (best === undefined || best.u === null || isLater(newest.u, best.u));
        let value: T;
        let answeredBy: DegradedShellLine['answeredBy'];
        let servedU: string | null | undefined;
        if (fromNewest && newest !== null) {
          value = clone(newest.value) as T; // L holds an earlier live answer of this same shell read
          answeredBy = 'L';
          servedU = newest.u;
        } else if (best) {
          value = best.value;
          answeredBy = best.step;
          servedU = best.u;
        } else {
          value = nonLive !== undefined && nonLive !== null ? nonLive : reads.floor();
          answeredBy = 'floor';
          servedU = undefined;
        }

        // 5. Stale: older than K, the floor, or a FULL plain read of unknown age (T3b, R1).
        const stale =
          answeredBy === 'floor' ||
          (known !== null && servedU !== undefined && (servedU === null || isLater(known, servedU))) ||
          (reader === 'full' && answeredBy === 'Pl' && planKnown === null && !planNoVersion && !refused);

        // 7. One line when the answer is not the target (I8).
        if (answeredBy !== target) {
          deps.onDegraded?.({ reader, probe, target, answeredBy, stale, ms: Math.round(clock.awakeMs()) });
        }
        return { value, stale };
      } finally {
        clock.stop();
      }
    },
  };
}
