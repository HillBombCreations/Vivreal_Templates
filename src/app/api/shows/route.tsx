import { NextResponse } from "next/server";
import { getShowsPaginated } from "@/lib/api/shows";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get("collectionId") || undefined;
    const limit = Number(searchParams.get("limit") || "20");
    const skip = Number(searchParams.get("skip") || "0");

    const result = await getShowsPaginated({ collectionId, limit, skip });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[GET /api/shows] Error:", err);
    return NextResponse.json(
      { success: false, message: "Server error" },
      { status: 500 }
    );
  }
}
