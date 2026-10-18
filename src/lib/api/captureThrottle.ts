/**
 * V7.319 (research-sentry-quota-2026-10-17.md, section 5 rank 4): at most one
 * Sentry capture per process per window for a swallowed VR_Client_API read.
 *
 * WHY. One render reads about 14 upstream paths, and `client.ts` captured each
 * failed read, so a single dead upstream cost about 14 events per page view:
 * 13 of every 14 incident events were repeats, on an error quota of about
 * 5,000 a period that the fleet shares with the portal. Each customer site is
 * its own deployment, so a per-process window is a per-site window.
 *
 * WHAT IT KEEPS. The first failure in a window is captured. Later failures in
 * the same window are counted, not sent, and the next capture carries that
 * count, so the size of an incident is still readable from Sentry. The
 * `site.upstream.fallback` log line in `client.ts` still prints for EVERY
 * failure, so the full count is in the logs either way.
 *
 * No `server-only` import, so it runs under `node --test`.
 */

/** Five minutes: the window the research proposed. */
export const FETCH_FAILURE_CAPTURE_WINDOW_MS = 5 * 60 * 1000;

export interface CaptureDecision {
  /** Send this one. */
  capture: boolean;
  /** Failures held back since the last capture (reported on a capture). */
  suppressed: number;
}

export interface CaptureThrottle {
  take(): CaptureDecision;
}

export function createCaptureThrottle(
  windowMs: number = FETCH_FAILURE_CAPTURE_WINDOW_MS,
  now: () => number = Date.now,
): CaptureThrottle {
  let windowStart: number | null = null;
  let suppressed = 0;
  return {
    take() {
      const t = now();
      if (windowStart === null || t - windowStart >= windowMs || t < windowStart) {
        const held = suppressed;
        windowStart = t;
        suppressed = 0;
        return { capture: true, suppressed: held };
      }
      suppressed += 1;
      return { capture: false, suppressed };
    },
  };
}
