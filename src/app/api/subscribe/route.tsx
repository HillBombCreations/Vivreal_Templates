import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { subscribeUser } from "@/lib/api/subscribe";
import { SUBSCRIBE_REJECTED_MESSAGE, buildSubscribeRejectionCapture } from "@/lib/api/errorCapture";
import { createCaptureThrottle } from "@/lib/api/captureThrottle";
import { mergeAttributionFields } from "@/lib/leadAttribution";
import { isValidEmail } from "@/lib/emailShape";

/**
 * Sanitize optional extra subscriber attributes (e.g. the footer newsletter's
 * { location } select): a flat object, string values only, small and capped —
 * anything else is dropped silently (the email subscription still succeeds).
 */
function sanitizeFields(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    if (key === "email" || key === "collectionId" || key === "type") continue;
    if (key.length > 40 || value.length > 200) continue;
    out[key] = value;
    if (++count >= 8) break;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * At most one Sentry capture per process per 5 minutes for each kind of
 * refused sign-up (stage and upstream status), the same throttle the contact
 * route uses. Module scope so it outlives a request.
 */
const SUBSCRIBE_REJECTION_CAPTURES = createCaptureThrottle();

/**
 * Tell Sentry a sign-up was refused, by stage and status only, then flush
 * before the caller responds: Amplify can freeze the instance the moment the
 * response is sent, and a queued event would go with it. Never the address.
 */
async function reportRejection(details: {
  stage: "missing-collection" | "upstream-rejected";
  upstreamStatus?: number;
}): Promise<void> {
  const gate = SUBSCRIBE_REJECTION_CAPTURES.take(`${details.stage}:${details.upstreamStatus ?? ""}`);
  if (!gate.capture) return;
  Sentry.withScope((scope) => {
    scope.addEventProcessor(withoutRequestPayload);
    Sentry.captureMessage(
      SUBSCRIBE_REJECTED_MESSAGE,
      buildSubscribeRejectionCapture({ ...details, siteId: process.env.SITE_ID, suppressed: gate.suppressed }),
    );
  });
  await Sentry.flush(1500);
}

/**
 * The tags are not the only thing an event carries. This route runs on Node,
 * where the SDK's defaults attach the incoming request body (the address) as
 * `request.data`, and record every `console.error` of the request as a
 * breadcrumb (`clientFetch` and `subscribeUser` log the upstream error text,
 * which can quote the address). A scope processor runs after all of those, so
 * this event keeps only the route's method and URL.
 */
function withoutRequestPayload(event: Sentry.Event): Sentry.Event {
  const { request, ...rest } = event;
  return {
    ...rest,
    breadcrumbs: [],
    ...(request ? { request: { method: request.method, url: request.url } } : {}),
  };
}

export async function POST(req: Request) {
  try {
    const { email, collectionId, fields } = await req.json();

    // The earliest point at which we can refuse an address, and the only one
    // this site controls. `isValidEmail` is the same rule VR_Client_API applies
    // at the write boundary (src/shared/contactGuards.js EMAIL_SHAPE); see
    // src/lib/emailShape.ts for why it is stated in both places.
    // Not reported: a visitor can correct it, and it is mostly bot noise.
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email." },
        { status: 400 }
      );
    }

    // Forward exactly what was validated. Upstream trims and lowercases too, so
    // this changes no stored byte; it removes the gap where the value we
    // checked and the value we sent could differ.
    const address = email.trim();

    if (!collectionId) {
      // The current client refuses before posting, so only a stale or broken
      // one reaches this, and every sign-up from it is lost.
      await reportRejection({ stage: "missing-collection" });
      return NextResponse.json(
        { success: false, message: "Missing collectionId." },
        { status: 400 }
      );
    }

    // C4 — fold the visitor's FIRST touch into the subscriber record, read
    // SERVER-SIDE from the `vr_attr` cookie on this same-origin POST. This is
    // the choke point every email-capture surface funnels through (hero inline,
    // footer newsletter, exit-intent popup), so one merge here attributes all
    // of them with no renderer change and nothing the client can spoof.
    //
    // Applied AFTER sanitizeFields() on purpose: the 8-key cap there bounds
    // CLIENT-supplied attributes, and these seven are server-derived. The merge
    // never clobbers a submitted key of the same name, and returns the original
    // reference untouched when no cookie is present — so a request without
    // `vr_attr` (i.e. every customer site in the fleet, where the cookie does
    // not exist) produces a byte-identical payload to today's.
    const cookieHeader = req.headers.get("cookie");
    const attributedFields = mergeAttributionFields(sanitizeFields(fields), cookieHeader, process.env.SITE_ID);

    const result = await subscribeUser(address, collectionId, attributedFields);
    if (!result.ok) {
      await reportRejection({ stage: "upstream-rejected", upstreamStatus: result.status });
      return NextResponse.json(
        { success: false, message: "Subscribe failed." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/subscribe] Error:", err);
    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
