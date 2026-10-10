import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { PageWithBlocks } from '@hillbombcreations/site-renderer/bindings';
import { createReportThrottle, displayMismatchReport, displayMismatchThrottleKey } from './displayMismatch';

/**
 * Module scope on purpose: renders are per request, so the throttle has to
 * outlive one. See `createReportThrottle` for its per-instance limits.
 */
const SENT = createReportThrottle();

/**
 * The Sentry call site for F-C7's `site.render.display_mismatch` (the
 * decision is the pure `./displayMismatch.ts`). Sends nothing for a page whose
 * blocks agree, which is every page once DS-39 has run, and at most once per
 * page and block set per hour per instance for one that does not (the log
 * line is throttled with it, since it is the same per-visit volume).
 */
export function reportDisplayMismatches(page: PageWithBlocks | null | undefined, slug: string): void {
  const report = displayMismatchReport(page, { siteId: process.env.SITE_ID || '', slug });
  if (!report) return;
  if (!SENT.shouldSend(displayMismatchThrottleKey(report))) return;
  console.warn(JSON.stringify({ event: report.message, ...report.capture.tags }));
  Sentry.captureMessage(report.message, report.capture);
}
