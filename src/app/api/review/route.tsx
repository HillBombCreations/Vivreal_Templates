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
