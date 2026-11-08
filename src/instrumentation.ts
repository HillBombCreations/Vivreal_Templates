import { isSentryReportingEnabled, resolveSentryEnvironment } from "@/lib/sentry/reportingGate";
import { scrubBreadcrumbCredentials, scrubCredentials } from "@/lib/sentry/scrubCredentials";

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
      // Owner Q14 (next release 2026-11, plan 3.PII, T8): explicit. It stops
      // only the SDK's own IP; cookies and headers still arrive, so the hooks
      // delete them (src/lib/sentry/scrubCredentials.ts).
      sendDefaultPii: false,
      beforeSend: scrubCredentials,
      beforeSendTransaction: scrubCredentials,
      beforeBreadcrumb: scrubBreadcrumbCredentials,
      // Open-backlog release 2026-11 (Sentry body leak): the SDK never reads
      // a request body. By default it wraps `req.on("data")`, which Next 16
      // reads every body with, and puts the body (a contact form's name,
      // email, phone and message) on every event of that request, whatever
      // `sendDefaultPii` says. "none" skips that wrapper entirely
      // (`@sentry/core` 10.75.3 `integrations/http/server-subscription.js`).
      // `disableIncomingRequestSpans: true` repeats the Next.js SDK's own
      // default for this integration, which this one replaces by name. The
      // hooks above delete `request.data` as well, for every runtime.
      integrations: [
        Sentry.httpIntegration({ disableIncomingRequestSpans: true, maxIncomingRequestBodySize: "none" }),
      ],
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
      // Owner Q14 (next release 2026-11, plan 3.PII, T8): explicit. It stops
      // only the SDK's own IP; cookies and headers still arrive, so the hooks
      // delete them (src/lib/sentry/scrubCredentials.ts).
      sendDefaultPii: false,
      beforeSend: scrubCredentials,
      beforeSendTransaction: scrubCredentials,
      beforeBreadcrumb: scrubBreadcrumbCredentials,
    });
  }
}
