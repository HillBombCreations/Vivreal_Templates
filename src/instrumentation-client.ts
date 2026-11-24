import * as Sentry from "@sentry/nextjs";
import { isSentryReportingEnabled, resolveSentryEnvironment } from "@/lib/sentry/reportingGate";
import { IGNORED_BROWSER_ERRORS } from "@/lib/sentry/ignoredBrowserErrors";
import { scrubBreadcrumbCredentials, scrubCredentials } from "@/lib/sentry/scrubCredentials";
import { STYLESHEET_LOAD_WARNING, dropStylesheetLoadRejection, installStylesheetRetry } from "@/lib/sentry/stylesheetLoad";

// V7.319. Read through literal `process.env.NEXT_PUBLIC_*` accesses so Next
// inlines them at build time. Without a label the SDK called every event
// `production`, and without `enabled` any runtime with a DSN sent, so a local
// run could spend the fleet's shared error quota. See reportingGate.ts.
const sentryEnvironment = resolveSentryEnvironment(
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  process.env.NODE_ENV,
);
const sentryEnabled = isSentryReportingEnabled({
  environment: sentryEnvironment,
  devOptIn: process.env.NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV,
});

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: sentryEnvironment,
  enabled: sentryEnabled,

  // Abandoned View Transitions are not failures (see ignoredBrowserErrors.ts).
  ignoreErrors: IGNORED_BROWSER_ERRORS,

  // Errors-only — no performance tracing, no session replay
  // This keeps Sentry billing minimal for hundreds of template sites
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Owner Q14 (next release 2026-11, plan 3.PII, T8): explicit, and the same
  // credential and IP scrub as the server (src/lib/sentry/scrubCredentials.ts).
  sendDefaultPii: false,
  beforeSend: scrubCredentials,
  beforeSendTransaction: scrubCredentials,
  beforeBreadcrumb: scrubBreadcrumbCredentials,
});

// VIVREAL-TEMPLATES-Q (release C, decisions.md:1168): a stylesheet or font
// that fails to load is tried once more; a second failure is one handled
// warning naming the file and the page, never the stackless unhandled
// rejection React's stylesheet promise raises (dropped here, and only that
// one). See src/lib/sentry/stylesheetLoad.ts.
Sentry.addEventProcessor(dropStylesheetLoadRejection);
if (typeof window !== "undefined") {
  installStylesheetRetry(document, window, ({ file, page }) => {
    Sentry.captureMessage(STYLESHEET_LOAD_WARNING, {
      level: "warning",
      tags: { stylesheet_file: file, page },
      fingerprint: [STYLESHEET_LOAD_WARNING],
    });
  });
}
