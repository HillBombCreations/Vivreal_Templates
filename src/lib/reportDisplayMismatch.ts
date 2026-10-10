import 'server-only';
import * as Sentry from '@sentry/nextjs';
import type { PageWithBlocks } from '@hillbombcreations/site-renderer/bindings';
import { displayMismatchReport } from './displayMismatch';

/**
 * The Sentry call site for F-C7's `site.render.display_mismatch` (the
 * decision is the pure `./displayMismatch.ts`). Sends nothing for a page whose
 * blocks agree, which is every page once DS-39 has run.
 */
export function reportDisplayMismatches(page: PageWithBlocks | null | undefined, slug: string): void {
  const report = displayMismatchReport(page, { siteId: process.env.SITE_ID || '', slug });
  if (!report) return;
  console.warn(JSON.stringify({ event: report.message, ...report.capture.tags }));
  Sentry.captureMessage(report.message, report.capture);
}
