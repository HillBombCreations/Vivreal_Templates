import * as Sentry from "@sentry/nextjs";
import { isSentryReportingEnabled, resolveSentryEnvironment } from "@/lib/sentry/reportingGate";
import { IGNORED_BROWSER_ERRORS } from "@/lib/sentry/ignoredBrowserErrors";
import { scrubBreadcrumbCredentials, scrubCredentials } from "@/lib/sentry/scrubCredentials";

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
