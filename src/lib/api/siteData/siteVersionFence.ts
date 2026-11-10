import 'server-only';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { fetchSiteVersion, isPreviewRender } from '@/lib/api/client';
import { RECORD_DIR_ENV } from '@/lib/api/snapshot/constants';
import { AWAKE_TICK_MS, startAwakeStopwatch, startAwakeTimeout } from '@/lib/awakeTimeout';
import {
  createSiteVersionFence,
  readerClassFor,
  type ReaderClass,
  type ShellReads,
  type ShellResolution,
  type SiteVersionFence,
} from '@/lib/cacheInvalidation';

const SITE_ID = process.env.SITE_ID || '';

/** The process-wide slot this instance's fence lives in. */
const FENCE_SLOT = Symbol.for('vivreal.templates.siteVersionFence');

/**
 * This instance's site version fence (F41, RW-4): ONE per server process, on
 * `globalThis`, not in module scope. Next 16 bundles pages and route handlers
 * in different layers, each with its own copy of this module; measured, a
 * module-scope fence made 2 probes in one interval across a page, its share
 * image and the sitemap. Held here, every reader shares one probe slot and one
 * `K`, `NV` and `L` (I5). The rule is `createSiteVersionFence` in
 * `@/lib/cacheInvalidation`.
 */
const slot = globalThis as unknown as Record<symbol, SiteVersionFence | undefined>; // a symbol-keyed slot on the process global
const FENCE: SiteVersionFence = (slot[FENCE_SLOT] ??= createSiteVersionFence({
  siteId: SITE_ID,
  probe: (signal) => fetchSiteVersion(SITE_ID, signal),
  now: Date.now,
  // Armed one tick early (review pass 6 N3). An awake timer expires on its
  // next 100 ms tick at or after its budget, so each deadline ran up to a
  // tick over, and the probe wait plus the fresh read's deadline put a cold
  // resolution about 200 ms past I3's 6.5 s (measured 6.70 s). One tick
  // early keeps every deadline at or under the design's figure.
  startTimeout: (ms, onExpire) => startAwakeTimeout(Math.max(0, ms - AWAKE_TICK_MS), onExpire),
  startStopwatch: startAwakeStopwatch,
  onProbeFailure: (reason) => console.warn(`[siteVersion] probe failed: ${reason}`),
  onDegraded: (line) => console.warn(JSON.stringify({ event: 'site.shell.degraded', siteId: SITE_ID || 'unknown', ...line })),
}));

/** Inside `next build` (or the snapshot wrapper's build): PLAIN, as `client.ts`'s floor decides. */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build' || !!process.env[RECORD_DIR_ENV];
}

/** This render's reader class (design section 6). */
async function readerClass(): Promise<ReaderClass> {
  if (!SITE_ID || isBuildPhase()) return 'plain';
  if (await isPreviewRender()) return 'plain';
  try {
    return readerClassFor(workUnitAsyncStorage.getStore(), workAsyncStorage.getStore());
  } catch {
    // Next moved its internals: KNOWN only ever reads through the data cache.
    return 'known';
  }
}

/**
 * One resolution per request, keyed by Next's work store. React `cache` is one
 * render pass, but a refused page (a stale shell, I7) makes Next render the
 * 500 in a second pass of the same request (`app-render.js`, the error payload
 * runs inside the same `workAsyncStorage.run`), and a route handler reads the
 * shell two or three times (N3). Without this each pass resolves again, and a
 * request on a cold server waits out the fresh read's deadline twice (I3,
 * measured: 13.5 s for one request against the 6.5 s budget).
 */
const RESOLUTIONS = new WeakMap<object, Promise<ShellResolution<unknown>>>();

/** This render's site shell through the fence. */
export function readShellThroughFence<T>(
  reads: ShellReads<T>,
  path: string,
  isLive: (value: T) => boolean,
): Promise<ShellResolution<T>> {
  let request: object | undefined;
  try {
    request = workAsyncStorage.getStore();
  } catch {
    request = undefined;
  }
  const shared = request ? RESOLUTIONS.get(request) : undefined;
  if (shared) return shared as Promise<ShellResolution<T>>; // the one shell read of this request, always this type
  const resolution = (async () => FENCE.resolve(await readerClass(), reads, path, isLive))();
  if (request) RESOLUTIONS.set(request, resolution);
  return resolution;
}

/** A `site.*` webhook reached this instance: the next FULL render probes first. Never waits (G5). */
export function markSiteVersionProbeDue(): void {
  FENCE.markProbeDue();
}
