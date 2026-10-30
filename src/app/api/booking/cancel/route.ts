import { NextRequest, NextResponse } from "next/server";
import { handleBookingRoute } from "@/lib/booking/bookingProxy";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * POST /api/booking/cancel (owner ideas 2026-10-29, plan 3.4, T3). A thin call
 * site: every rule (size cap, field allowlist, honeypot, what reaches the
 * browser) is in lib/booking/bookingProxy.ts, where the tests reach it.
 */
export async function POST(request: NextRequest) {
  const answer = await handleBookingRoute(
    "cancel",
    request,
    {
      apiKey: process.env.API_KEY,
      clientApiUrl: process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io",
      siteId: process.env.SITE_ID,
    },
    fetch,
  );
  return NextResponse.json(answer.body, { status: answer.status, headers: { "Cache-Control": "no-store" } });
}
