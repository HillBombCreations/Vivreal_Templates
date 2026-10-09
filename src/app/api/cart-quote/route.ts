import { NextRequest, NextResponse } from "next/server";
import { redactSecrets } from "@/lib/log/redact";
import { isCartQuoteRequestLine } from "@/lib/cartQuote";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * POST /api/cart-quote: the bag's live prices (F4, storefront task T2).
 *
 * Mirrors `/api/validate-coupon`: validates the lines, then forwards
 * `{ cartLineItems }` to VR_Client_API `POST /tenant/cartQuote` with the site
 * API key. The upstream prices the lines with the same function checkout uses
 * and answers `{ lines: [{ priceId, unitCents, saleUnitCents, saleName }] }`
 * (release plan contract C6). No code is ever sent: the upstream answers a body
 * carrying one with a 400.
 *
 * `no-store` both ways. A quote is only worth anything while it is current; a
 * cached one is exactly the stale sale this route exists to prevent. Any
 * failure answers a non-200, and the bag then shows list prices, which are
 * never below what checkout charges. The answer is read and checked in the
 * browser (`parseCartQuote`), so it is passed through here unchanged.
 */
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const cartLineItems = (body as { cartLineItems?: unknown } | null)?.cartLineItems;

  if (!Array.isArray(cartLineItems) || cartLineItems.length === 0) {
    return NextResponse.json({ error: "No cart line items provided" }, { status: 400, headers: NO_STORE });
  }
  if (!cartLineItems.every(isCartQuoteRequestLine)) {
    return NextResponse.json({ error: "Invalid cart line item format" }, { status: 400, headers: NO_STORE });
  }

  const apiKey = process.env.API_KEY;
  const clientApiUrl = process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

  try {
    const res = await fetch(`${clientApiUrl}/tenant/cartQuote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey ?? "" },
      body: JSON.stringify({
        cartLineItems: cartLineItems.map((l) => ({ price: l.price, quantity: l.quantity })),
      }),
      cache: "no-store",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || data === null) {
      console.error(`[cart-quote] upstream answered ${res.status}`);
      return NextResponse.json({ error: "Prices could not be checked" }, { status: 502, headers: NO_STORE });
    }

    // VR_Client_API returns a { success, data } envelope.
    return NextResponse.json(data.data ?? data, { headers: NO_STORE });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Redacted by shape: a fetch failure quotes the URL it was calling (H37).
    console.error("[cart-quote] upstream request failed:", redactSecrets(message));
    return NextResponse.json({ error: "Prices could not be checked" }, { status: 502, headers: NO_STORE });
  }
}
