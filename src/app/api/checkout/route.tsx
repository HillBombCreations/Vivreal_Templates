/* eslint-disable @typescript-eslint/no-explicit-any */
export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { createServerFetchEdge } from "@/lib/server-fetch";
import { noStore } from "@/lib/proxyUtils";
import { edgeLogger } from "@/lib/edge-logger";

type CheckoutItem = {
  price: string;
  quantity: number;
};

type CheckoutPayload = {
  products: CheckoutItem[];
  businessName: string;
  contactEmail: string;
  requiresShipping: boolean;
  originUrl: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

function isCheckoutItem(x: any): x is CheckoutItem {
  return (
    x &&
    typeof x === "object" &&
    isNonEmptyString(x.price) &&
    isPositiveInt(x.quantity)
  );
}

export async function POST(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  const API_KEY = process.env.API_KEY;
  const API_URL = "https://client.vivreal.io";

  if (!API_KEY) {
    edgeLogger.error("checkout(edge): missing API_KEY", { requestId });
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  const serverFetch = createServerFetchEdge({
    req,
    baseURL: API_URL,
    timeoutMs: 15000,
    requestId,
    logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
  });

  let body: CheckoutPayload;
  try {
    body = (await req.json()) as CheckoutPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  if (
    !Array.isArray(body?.products) ||
    body.products.length === 0 ||
    !body.products.every(isCheckoutItem) ||
    !isNonEmptyString(body?.businessName) ||
    !isNonEmptyString(body?.contactEmail) ||
    typeof body?.requiresShipping !== "boolean"
  ) {
    return NextResponse.json(
      { error: "Missing or invalid fields" },
      { status: 400, headers: noStore({ "x-request-id": requestId }) }
    );
  }

  const upstreamPath = "/tenant/createCheckoutSession";

  try {
    const res = await serverFetch(upstreamPath, {
      method: "POST",
      headers: {
        Authorization: `${API_KEY}`,
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-forwarded-host":
          req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "",
        "x-forwarded-proto": req.headers.get("x-forwarded-proto") ?? "https",
        "Cache-Control": "no-store",
      },
      cache: "no-store",
      next: { revalidate: 0 },
      body: JSON.stringify({
        products: body.products,
        stripeKey: process.env.STRIPE_SECRET_KEY,
        businessName: body.businessName,
        contactEmail: body.contactEmail,
        requiresShipping: body.requiresShipping,
        originUrl: body.originUrl,
        updatedTemplate: true
      }),
    });

    const contentType = res.headers.get("content-type") || "application/json";

    if (!contentType.includes("application/json")) {
      const text = await res.text();
      return new NextResponse(text, {
        status: res.status,
        headers: {
          ...noStore({ "x-request-id": requestId }),
          "content-type": contentType,
        },
      });
    }

    const upstreamJson = await res.json().catch(() => null);

    const out = NextResponse.json(upstreamJson ?? { ok: res.ok }, {
      status: res.status,
      headers: noStore({ "x-request-id": requestId }),
    });

    if (!res.ok) {
      edgeLogger.warn("checkout(edge): upstream non-OK", {
        requestId,
        status: res.status,
      });
    } else {
      edgeLogger.info("checkout(edge): upstream OK", {
        requestId,
        status: res.status,
      });
    }

    return out;
  } catch (err: any) {
    const kind =
      err?.name === "AbortError" ? "Timeout/AbortError" : String(err?.message || err);

    edgeLogger.error("checkout(edge): fetch failed", { requestId, err: kind });

    return NextResponse.json(
      { error: "Bad Gateway", detail: kind },
      { status: 502, headers: noStore({ "x-request-id": requestId }) }
    );
  }
}