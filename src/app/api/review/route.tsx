import { NextResponse } from "next/server";
import { createReview } from "@/lib/api/review";
import { REVIEW_REJECTED_MESSAGE, buildReviewRejectionCapture } from "@/lib/api/errorCapture";
import { createCaptureThrottle } from "@/lib/api/captureThrottle";
import { captureWithoutRequestPayload } from "@/lib/api/scrubbedCapture";

/**
 * At most one Sentry capture per process per 5 minutes for each upstream
 * status, the same throttle the subscribe and contact routes use. Module
 * scope so it outlives a request.
 */
const REVIEW_REJECTION_CAPTURES = createCaptureThrottle();

/**
 * Tell Sentry a review was lost, by upstream status only, flushed before the
 * caller responds. A review carries an email, a name and free text, so it
 * goes through the same scrub as a sign-up.
 */
async function reportRejection(upstreamStatus: number | undefined): Promise<void> {
  const gate = REVIEW_REJECTION_CAPTURES.take(`upstream-rejected:${upstreamStatus ?? ""}`);
  if (!gate.capture) return;
  await captureWithoutRequestPayload(
    REVIEW_REJECTED_MESSAGE,
    buildReviewRejectionCapture({ siteId: process.env.SITE_ID, upstreamStatus, suppressed: gate.suppressed }),
  );
}

/**
 * F103: VR_Client_API answers 429 when a shop's reviews arrive faster than it
 * takes them (REVIEW_RATE_LIMIT). The review form shows a server `error` first
 * (the renderer's `resolveErrorMessage`), so the visitor reads this and sends
 * it again later. A by-design answer, so not reported as a lost review.
 */
const REVIEW_RATE_LIMITED = "Lots of reviews are coming in right now. Try again shortly.";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = await createReview({
      email: body.email,
      name: body.name,
      review: body.review,
      // Keep rating numeric end-to-end (locked contract: decimal, e.g. 4.5).
      // Coerce defensively in case a client serializes it as a string.
      rating: typeof body.rating === 'number' ? body.rating : Number(body.rating),
      collectionId: body.collectionId,
      // Pass the honeypot through so the backend's spam check receives it.
      company_website: body.company_website,
    });

    if (!result.ok && result.status === 429) {
      return NextResponse.json({ success: false, error: REVIEW_RATE_LIMITED }, { status: 429 });
    }

    if (!result.ok) {
      await reportRejection(result.status);
      return NextResponse.json({ success: false, message: "Failed to create review" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/review] Error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
