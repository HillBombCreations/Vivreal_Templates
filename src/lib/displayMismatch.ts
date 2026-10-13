/**
 * F-C7 (v5 item 3): count the blocks whose stored `displayAs` and
 * `type.dispatchId` disagree, once per page render.
 *
 * WHAT DRAWS IS `binding.displayAs`; the Studio names a block by its type. On
 * a mismatched block the page shows one layout while the editor calls it
 * another, and nobody can tell from either side. The renderer's
 * `findDisplayMismatches` lists them (reports only, changes nothing that
 * draws); this turns its rows into one Sentry event per render, so the
 * disagreement is counted rather than guessed (ledger QA5-SIG-38).
 *
 * Volume: the fleet renders per request (`SITE_RENDER_MODE` unset, every route
 * dynamic), so a render IS a visit, and a crawler hit too. The call site
 * therefore sends through `createReportThrottle`: one event per page and block
 * set per instance per `DISPLAY_MISMATCH_THROTTLE_MS` (an hour). DS-39 aligns
 * the 7 known blocks before this deploys, so the expected count is 0; each
 * event after that is a block a writer stored inconsistently.
 *
 * Pure (the renderer's `/bindings` subpath imports nothing), so it runs under
 * `node --test`; the Sentry call lives at the call site.
 */
import { findDisplayMismatches, type DisplayMismatch, type PageWithBlocks } from '@hillbombcreations/site-renderer/bindings';

export const DISPLAY_MISMATCH_MESSAGE = 'site.render.display_mismatch';
export const DISPLAY_MISMATCH_FINGERPRINT = 'templates.render.displayMismatch';

export interface DisplayMismatchReport {
  message: typeof DISPLAY_MISMATCH_MESSAGE;
  capture: {
    level: 'warning';
    fingerprint: string[];
    tags: Record<string, string>;
    extra: { rows: DisplayMismatch[] };
  };
}

/** The event to send for this page, or `null` when every block agrees. */
export function displayMismatchReport(
  page: PageWithBlocks | null | undefined,
  { siteId, slug }: { siteId: string; slug: string },
): DisplayMismatchReport | null {
  const rows = findDisplayMismatches(page);
  if (rows.length === 0) return null;
  return {
    message: DISPLAY_MISMATCH_MESSAGE,
    capture: {
      level: 'warning',
      // One issue per page, so a page that is fixed stops reporting and a new
      // one opens its own issue.
      fingerprint: [DISPLAY_MISMATCH_FINGERPRINT, siteId || 'unknown', slug],
      tags: {
        siteId: siteId || 'unknown',
        slug,
        blockIds: rows.map((r) => r.blockId).join(','),
        count: String(rows.length),
      },
      extra: { rows },
    },
  };
}

/** One report per key per instance inside this window (an hour). */
export const DISPLAY_MISMATCH_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Bound on remembered keys. A key is a site page plus its mismatched block ids,
 * so the set is about the site's page count, but it is capped rather than
 * trusted to stay small.
 */
export const DISPLAY_MISMATCH_THROTTLE_MAX_KEYS = 500;

export interface ReportThrottle {
  /** True when this key has not been sent inside the window; records the send. */
  shouldSend(key: string): boolean;
  readonly size: number;
}

/**
 * An in-memory keyed throttle (the `failureMemo` pattern).
 *
 * ITS LIMITS, stated because they bound what the hour means: the memory is
 * per server instance and lost on a cold start, so the real ceiling is one
 * event per page per hour PER INSTANCE that serves it, plus one after each
 * cold start. That is bounded by the instance count, not by traffic, which is
 * the point. A full map drops expired keys first, then the oldest, so an
 * evicted key can report again early, never more often than once per
 * eviction.
 */
export function createReportThrottle({
  ttlMs = DISPLAY_MISMATCH_THROTTLE_MS,
  maxKeys = DISPLAY_MISMATCH_THROTTLE_MAX_KEYS,
  now = Date.now,
}: { ttlMs?: number; maxKeys?: number; now?: () => number } = {}): ReportThrottle {
  const sentAt = new Map<string, number>();
  return {
    shouldSend(key) {
      const t = now();
      const at = sentAt.get(key);
      if (at !== undefined && t - at < ttlMs) return false;
      sentAt.delete(key);
      if (sentAt.size >= maxKeys) {
        for (const [k, v] of sentAt) if (t - v >= ttlMs) sentAt.delete(k);
      }
      if (sentAt.size >= maxKeys) {
        const oldest = sentAt.keys().next().value;
        if (oldest !== undefined) sentAt.delete(oldest);
      }
      sentAt.set(key, t);
      return true;
    },
    get size() {
      return sentAt.size;
    },
  };
}

/** The throttle key: the page and the exact blocks that disagree. */
export function displayMismatchThrottleKey(report: DisplayMismatchReport): string {
  const { siteId, slug, blockIds } = report.capture.tags;
  return `${siteId}|${slug}|${blockIds}`;
}
