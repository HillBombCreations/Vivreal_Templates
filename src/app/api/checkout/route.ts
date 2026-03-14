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
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://dev-client.vivreal.io";

  const res = await fetch(`${clientApiUrl}/tenant/createCheckoutSession`, {
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

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "Checkout failed" },
      { status: res.status }
    );
  }

  // VR_Client_API returns { success, data: "stripe_url" } — extract the URL
  const url = data.data ?? data;
  return NextResponse.json({ url });
}
