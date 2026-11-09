import 'server-only';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { fetchSiteVersion } from '@/lib/api/client';
import { startAwakeTimeout } from '@/lib/awakeTimeout';
import {
  createSiteVersionFence,
  isFencedRender,
  readShell,
  type ShellReads,
  type SiteVersionFence,
} from '@/lib/cacheInvalidation';

const SITE_ID = process.env.SITE_ID || '';

/** The process-wide slot this instance's fence lives in. */
const FENCE_SLOT = Symbol.for('vivreal.templates.siteVersionFence');

/**
 * This instance's site version fence (F41, OD-01): ONE per server process,
 * so "at most one probe per 5 s" is per instance, the unit the stale copies
 * live in, and the version it knows lives as long as the instance does
 * (RW-4). Held on `globalThis`, not in module scope, because pages and route
 * handlers can be bundled in different layers, each with its own copy of this
 * module: the share image and sitemap routes must share the page's probe limit
 * and known version, never keep their own (RW-4 follow-up). See
 * `createSiteVersionFence` in `@/lib/cacheInvalidation` for the rule and what
 * it never does.
 */
const slot = globalThis as unknown as Record<symbol, SiteVersionFence | undefined>; // a symbol-keyed slot on the process global
const FENCE: SiteVersionFence = (slot[FENCE_SLOT] ??= createSiteVersionFence({
  siteId: SITE_ID,
  probe: (signal) => fetchSiteVersion(SITE_ID, signal),
  now: Date.now,
  startTimeout: (ms, onExpire) => startAwakeTimeout(ms, onExpire),
  onFailure: (reason) => console.warn(`[siteVersion] probe failed, the shell read keeps the last version it knew (a fresh read if none): ${reason}`),
}));

/** Whether this render reads the shell through the fence. Unreadable stores answer false: today's read. */
function readsThroughFence(): boolean {
  try {
    return isFencedRender(workUnitAsyncStorage.getStore(), workAsyncStorage.getStore());
  } catch {
    // Next moved its internals: read the site exactly as before.
    return false;
  }
}

/** This render's site shell through the fence (`readShell` in `@/lib/cacheInvalidation`). */
export function readShellThroughFence<T extends { readonly updatedAt?: unknown } | null | undefined>(
  reads: ShellReads<T>,
  path: string,
  isLive: (value: T) => boolean,
): Promise<T> {
  return readShell(FENCE, readsThroughFence(), reads, path, isLive);
}
