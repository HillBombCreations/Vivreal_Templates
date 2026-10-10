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
 * Volume: a render is an ISR regeneration (at most one per 300 s per page per
 * instance), not a visit, and DS-39 aligns the 7 known blocks before this
 * deploys, so the expected count is 0. Each event after that is a block a
 * writer stored inconsistently.
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
