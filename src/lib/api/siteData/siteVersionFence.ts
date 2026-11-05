import 'server-only';
import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external';
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external';
import { fetchSiteVersion } from '@/lib/api/client';
import { startAwakeTimeout } from '@/lib/awakeTimeout';
import { createSiteVersionFence, isOrdinaryPageRender } from '@/lib/cacheInvalidation';

const SITE_ID = process.env.SITE_ID || '';

/**
 * This instance's site version fence (F41, OD-01). Module scope on purpose:
 * one per server instance, so "at most one probe per 5 s" is per instance,
 * the unit the stale copies live in. See `createSiteVersionFence` in
 * `@/lib/cacheInvalidation` for the rule and what it never does.
 */
const FENCE = createSiteVersionFence({
  siteId: SITE_ID,
  probe: (signal) => fetchSiteVersion(SITE_ID, signal),
  now: Date.now,
  startTimeout: (ms, onExpire) => startAwakeTimeout(ms, onExpire),
  onFailure: (reason) => console.warn(`[siteVersion] probe failed, reading the site as before: ${reason}`),
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

/** The version this render's shell read carries, or null for today's unversioned read. */
export function shellReadVersion(): Promise<string | null> {
  return FENCE.versionFor(servesOrdinaryPage());
}
