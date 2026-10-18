import { isSentryReportingEnabled, resolveSentryEnvironment } from "@/lib/sentry/reportingGate";

// V7.319: the same environment gate as the browser (src/instrumentation-client.ts).
// Without it any server with a DSN sent, labelled `production`.
const sentryEnvironment = resolveSentryEnvironment(
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  process.env.NODE_ENV,
);
const sentryEnabled = isSentryReportingEnabled({
  environment: sentryEnvironment,
  devOptIn: process.env.NEXT_PUBLIC_SENTRY_ENABLE_IN_DEV,
});

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: sentryEnvironment,
      enabled: sentryEnabled,
      tracesSampleRate: 0,
      enableLogs: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: sentryEnvironment,
      enabled: sentryEnabled,
      tracesSampleRate: 0,
      enableLogs: false,
    });
  }
}
