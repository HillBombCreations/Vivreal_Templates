import { NextResponse } from "next/server";
import { subscribeUser } from "@/lib/api/subscribe";

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}

export async function POST(req: Request) {
  try {
    const { email, collectionId } = await req.json();

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email." },
        { status: 400 }
      );
    }

    if (!collectionId) {
      return NextResponse.json(
        { success: false, message: "Missing collectionId." },
        { status: 400 }
      );
    }

    const ok = await subscribeUser(email, collectionId);
    if (!ok) {
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
