import 'server-only';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { fetchSiteVersion } from '@/lib/api/client';
import { startAwakeTimeout } from '@/lib/awakeTimeout';
import { createSiteVersionFence, isOrdinaryPageRender, readShell, type ShellReads } from '@/lib/cacheInvalidation';

const SITE_ID = process.env.SITE_ID || '';

/**
 * This instance's site version fence (F41, OD-01). Module scope on purpose:
 * one per server instance, so "at most one probe per 5 s" is per instance,
 * the unit the stale copies live in, and the version it knows lives as long
 * as the instance does (RW-4). See `createSiteVersionFence` in
 * `@/lib/cacheInvalidation` for the rule and what it never does.
 */
const FENCE = createSiteVersionFence({
  siteId: SITE_ID,
  probe: (signal) => fetchSiteVersion(SITE_ID, signal),
  now: Date.now,
  startTimeout: (ms, onExpire) => startAwakeTimeout(ms, onExpire),
  onFailure: (reason) => console.warn(`[siteVersion] probe failed, the shell read keeps the last version it knew (a fresh read if none): ${reason}`),
});

/** Whether this render serves an ordinary page per request. Unreadable stores answer false: today's read. */
function servesOrdinaryPage(): boolean {
  try {
    return isOrdinaryPageRender(workUnitAsyncStorage.getStore(), workAsyncStorage.getStore());
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
  return readShell(FENCE, servesOrdinaryPage(), reads, path, isLive);
}
