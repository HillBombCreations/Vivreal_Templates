import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * POST /api/validate-coupon — cart promo preview.
 *
 * Mirrors `/api/checkout`: validates the body shape, then forwards
 * `{ code, cartLineItems }` to VR_Client_API `POST /tenant/validateCoupon` with
 * the site API key. The upstream looks up the coupon doc (scoped by group),
 * runs pure policy validation, and returns a PREVIEW the cart renders before
 * checkout. It NEVER mutates state — the authoritative discount is re-validated
 * + applied server-side at checkout (plan §1.3/§3 Option A).
 *
 * Upstream response shape (confirmed against VR_Client_API
 * src/services/tenant/validateCoupon.js):
 *   { valid, discountType, discountValue, appliesToLineIds, newSubtotal, reason? }
 * An invalid coupon is a NORMAL 200 answer carrying `valid:false` + `reason`.
 */

interface CartLineItem {
  /** Stripe price id. */
  price: string;
  quantity: number;
}

function isCartLineItem(item: unknown): item is CartLineItem {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.price === "string" &&
    obj.price.length > 0 &&
    typeof obj.quantity === "number" &&
    obj.quantity > 0 &&
    Number.isInteger(obj.quantity)
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { code, cartLineItems } = body as {
    code?: unknown;
    cartLineItems?: unknown;
  };

  if (typeof code !== "string" || code.trim().length === 0) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  if (!Array.isArray(cartLineItems) || cartLineItems.length === 0) {
    return NextResponse.json({ error: "No cart line items provided" }, { status: 400 });
  }

  if (!cartLineItems.every(isCartLineItem)) {
    return NextResponse.json({ error: "Invalid cart line item format" }, { status: 400 });
  }

  const apiKey = process.env.API_KEY;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

  try {
    const upstreamUrl = `${clientApiUrl}/tenant/validateCoupon`;

    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ?? "",
      },
      body: JSON.stringify({
        // Normalize client-side to match the upstream validator (uppercase, trimmed).
        code: code.trim().toUpperCase(),
        cartLineItems: cartLineItems.map((l) => ({
          price: l.price,
          quantity: l.quantity,
        })),
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? data.message ?? "Coupon validation failed", detail: text.slice(0, 200) },
        { status: res.status }
      );
    }

    // VR_Client_API returns { success, data: {...} } envelope or the raw object.
    const result = data.data ?? data;
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Bad Gateway", detail: message },
      { status: 502 }
    );
  }
}
