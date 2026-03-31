import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface CheckoutItem {
  price: string;
  quantity: number;
}

function isCheckoutItem(item: unknown): item is CheckoutItem {
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
  const body = await request.json();
  const { products, requiresShipping, originUrl } = body;

  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json(
      { error: "No products provided" },
      { status: 400 }
    );
  }

  if (!products.every(isCheckoutItem)) {
    return NextResponse.json(
      { error: "Invalid product format" },
      { status: 400 }
    );
  }

  if (typeof originUrl !== "string" || originUrl.length === 0) {
    return NextResponse.json(
      { error: "Missing originUrl" },
      { status: 400 }
    );
  }

  // Forward to VR_Client_API — Stripe key is resolved server-side from group integrations
  const apiKey = process.env.API_KEY;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

  try {
    const upstreamUrl = `${clientApiUrl}/tenant/createCheckoutSession`;
    console.log('[checkout] Calling:', upstreamUrl, 'apiKey present:', !!apiKey);

    const res = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey ?? "",
      },
      body: JSON.stringify({
        products,
        requiresShipping: Boolean(requiresShipping),
        originUrl,
      }),
    });

    const text = await res.text();
    console.log('[checkout] Response status:', res.status, 'body:', text.slice(0, 300));

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? data.message ?? "Checkout failed", detail: text.slice(0, 200) },
        { status: res.status }
      );
    }

    // VR_Client_API returns { success, data: { url, sessionId } } or { data: "stripe_url" }
    const url = data.data?.url ?? data.data ?? data.url;
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[checkout] Fetch error:', message);
    return NextResponse.json(
      { error: "Bad Gateway", detail: message },
      { status: 502 }
    );
  }
}
