/**
 * V7.319 (research-sentry-quota-2026-10-17.md, section 5 rank 4): at most one
 * Sentry capture per process per window for each failing VR_Client_API path.
 *
 * WHY. One render reads about 14 upstream paths, and a failing path is read on
 * every page view, so a dead upstream sent a capture per read: 13 of every 14
 * incident events were repeats, on an error quota of about 5,000 a period
 * that the fleet shares with the portal. Each customer site is its own
 * deployment, so a per-process window is a per-site window.
 *
 * KEYED BY FAILURE SIGNATURE (review of PR 197, C5). The caller passes the
 * query-free path, the same value the Issue fingerprint uses, so each path
 * keeps its own window: a second, different failing path inside the five
 * minutes still reaches Sentry as its own Issue, and one persistently failing
 * read cannot hold the slot for every other path.
 *
 * WHAT IT KEEPS. The first failure of a key in a window is captured. Later
 * failures of that key in the window are counted, and the next capture of the
 * SAME key carries the count. That count is a lower bound on what Sentry
 * shows, not the incident size: if the key never fails again, its last count
 * is never sent. The full count is the `site.upstream.fallback` log line in
 * `client.ts`, which still prints for every failure.
 *
 * The map holds one entry per distinct key; keys are query-free API paths, a
 * small fixed set per site, so it does not grow with traffic.
 *
 * No `server-only` import, so it runs under `node --test`.
 */

/** Five minutes: the window the research proposed. */
export const FETCH_FAILURE_CAPTURE_WINDOW_MS = 5 * 60 * 1000;

export interface CaptureDecision {
  /** Send this one. */
  capture: boolean;
  /** Failures of this key held back since its last capture (reported on a capture). */
  suppressed: number;
}

export interface CaptureThrottle {
  /** `key` is the failure signature (the query-free path); absent means one shared key. */
  take(key?: string): CaptureDecision;
}

export function createCaptureThrottle(
  windowMs: number = FETCH_FAILURE_CAPTURE_WINDOW_MS,
  now: () => number = Date.now,
): CaptureThrottle {
  const windows = new Map<string, { start: number; suppressed: number }>();
  return {
    take(key = '') {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= windowMs || t < w.start) {
        windows.set(key, { start: t, suppressed: 0 });
        return { capture: true, suppressed: w?.suppressed ?? 0 };
      }
      w.suppressed += 1;
      return { capture: false, suppressed: w.suppressed };
    },
  };
}
