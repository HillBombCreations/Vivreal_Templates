import { NextRequest, NextResponse } from "next/server";
import { redactSecrets, topLevelKeys } from "@/lib/log/redact";

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

/**
 * What the shopper is told when checkout will not start.
 *
 * Deliberately OUR words. The upstream refusal prose names payment companies
 * and internal group ids ("No active Stripe integration found for this group"),
 * and this string is rendered straight into the cart, so echoing it would put
 * the wrong company's name and our internal vocabulary in front of a customer.
 * Every branch also says what to DO, because a cart that only says no is a
 * dead button.
 */
function shopperMessage(status: number): string {
  if (status === 404 || status === 409 || status === 422) {
    return "Something in your bag is no longer available. Refresh the page, then try again.";
  }
  if (status === 429) {
    return "Checkout is busy right now. Wait a moment, then try again.";
  }
  if (status >= 500) {
    return "We could not start checkout just now. Please try again in a moment.";
  }
  return "We could not start checkout. Refresh the page, then try again.";
}

export async function POST(request: NextRequest) {
  // A malformed body used to throw here, OUTSIDE the try, so Next answered 500
  // with a stack for what is plainly a bad request. Read it defensively and
  // answer 400 (H37).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "We could not read that request." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json(
      { error: "We could not read that request." },
      { status: 400 }
    );
  }

  const { products, requiresShipping, originUrl, code } = body as Record<string, unknown>;

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

  // Optional promo code — advisory only. The client charset is constrained here
  // to a sane bound; VR_Client_API RE-VALIDATES + applies it (never trusts the
  // client) before building the Stripe session (plan §1.3). A malformed value
  // is dropped rather than rejected so checkout still proceeds at full price.
  const normalizedCode =
    typeof code === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(code.trim())
      ? code.trim().toUpperCase()
      : undefined;

  // Forward to VR_Client_API — Stripe key is resolved server-side from group integrations
  const apiKey = process.env.API_KEY;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

  try {
    const upstreamUrl = `${clientApiUrl}/tenant/createCheckoutSession`;

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
        // Only forward when present so no-code checkouts are byte-identical.
        ...(normalizedCode ? { code: normalizedCode } : {}),
      }),
    });

    const text = await res.text();

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    // H37: NEVER log this body. On success it carries the hosted checkout URL,
    // which is a BEARER CAPABILITY, not an identifier: anyone who can read the
    // log can open that shopper's checkout session. Log the status, whether a
    // key was configured, and the top-level field NAMES. Names are safe; values
    // are not, whatever the field happens to be called.
    console.log(
      "[checkout] upstream status:",
      res.status,
      "apiKey present:",
      !!apiKey,
      "fields:",
      topLevelKeys(data).join(",")
    );

    if (!res.ok) {
      // No `detail`: it echoed up to 200 bytes of the upstream body straight
      // into the browser, which is the same leak in the other direction and has
      // no consumer (the cart reads `error`). The delivery-quote route already
      // pins this rule for itself.
      return NextResponse.json(
        { error: shopperMessage(res.status) },
        { status: res.status }
      );
    }

    // VR_Client_API returns { success, data: { url, sessionId } } or { data: "stripe_url" }
    // Resolve to a STRING only. The old chain fell through to `data.data`
    // itself when the envelope had no `url`, which handed the browser an object
    // where a URL belongs and left the shopper on a button that did nothing.
    const candidate = data?.data?.url ?? data?.data ?? data?.url;
    const url = typeof candidate === "string" ? candidate : "";

    if (!url.startsWith("https://")) {
      console.error(
        "[checkout] upstream returned no usable checkout URL; fields:",
        topLevelKeys(data).join(",")
      );
      return NextResponse.json({ error: shopperMessage(502) }, { status: 502 });
    }

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Redacted by SHAPE: a fetch failure message routinely quotes the URL it
    // was calling, and an upstream one can quote the response.
    console.error("[checkout] upstream request failed:", redactSecrets(message));
    return NextResponse.json(
      { error: shopperMessage(502) },
      { status: 502 }
    );
  }
}
