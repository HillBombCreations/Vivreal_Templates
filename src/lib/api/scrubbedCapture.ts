import * as Sentry from "@sentry/nextjs";
import { stripQueryString, type SentryCaptureContext } from "@/lib/api/errorCapture";

/**
 * How long a visitor-facing route waits for its capture to leave. Amplify can
 * freeze the instance the moment the response is sent, and a queued event
 * would go with it, so the flush runs BEFORE the response.
 */
export const SCRUBBED_CAPTURE_FLUSH_MS = 1500;

/**
 * The capture context is not the only thing an event carries. A route that
 * runs on Node gets, from the SDK's defaults, the incoming request body as
 * `request.data` (read whatever `sendDefaultPii` says) and every
 * `console.error` of the request as a breadcrumb (`clientFetch` and the
 * route's own helpers log the upstream error text, which can quote what the
 * visitor typed). This keeps only the method and the query-free URL.
 *
 * Added as a scope processor inside `withScope`, it runs after the client's
 * own processors (which set `request.data`) and after the scope's
 * breadcrumbs are applied, so nothing the SDK adds can get past it.
 * `scrubbedCapture.sdk.test.ts` proves that against the installed SDK.
 */
export function withoutRequestPayload(event: Sentry.Event): Sentry.Event {
  const { request, ...rest } = event;
  if (!request) return { ...rest, breadcrumbs: [] };
  const url = typeof request.url === "string" ? stripQueryString(request.url) : request.url;
  return { ...rest, breadcrumbs: [], request: { method: request.method, url } };
}

/**
 * Send one capture with the visitor's payload stripped, then flush. For
 * routes whose request body is a person's details (a sign-up address, a
 * review's email, name and text). The caller throttles; this never throws.
 */
export async function captureWithoutRequestPayload(
  message: string,
  context: SentryCaptureContext,
): Promise<void> {
  Sentry.withScope((scope) => {
    scope.addEventProcessor(withoutRequestPayload);
    Sentry.captureMessage(message, context);
  });
  await Sentry.flush(SCRUBBED_CAPTURE_FLUSH_MS);
}
