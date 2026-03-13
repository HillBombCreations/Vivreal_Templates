import { NextResponse } from "next/server";
import { createReview } from "@/lib/api/review";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const success = await createReview({
      email: body.email,
      name: body.name,
      review: body.review,
      rating: body.rating,
      collectionId: body.collectionId,
    });

    if (!success) {
      return NextResponse.json({ success: false, message: "Failed to create review" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[POST /api/review] Error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}
