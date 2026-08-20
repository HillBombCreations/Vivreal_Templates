import { NextResponse } from "next/server";
import { subscribeUser } from "@/lib/api/subscribe";
import { mergeAttributionFields } from "@/lib/leadAttribution";

function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && /\S+@\S+\.\S+/.test(email);
}

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

export async function POST(req: Request) {
  try {
    const { email, collectionId, fields } = await req.json();

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
    const attributedFields = mergeAttributionFields(sanitizeFields(fields), cookieHeader);

    const ok = await subscribeUser(email, collectionId, attributedFields);
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
