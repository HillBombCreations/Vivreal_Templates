/* eslint-disable @typescript-eslint/no-explicit-any */
import Stripe from "stripe";
import { NextResponse, NextRequest } from "next/server";
import { createServerFetchEdge } from "@/lib/server-fetch";
import { edgeLogger } from "@/lib/edge-logger";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ConfirmCheckoutPayload = {
  sessionId: string;
  contactEmail: string;
  businessName: string;
};

export async function POST(req: NextRequest) {
  const requestId =
    req.headers.get("x-request-id") ??
    (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2));

  try {
    const { sessionId, contactEmail, businessName } =
      (await req.json()) as ConfirmCheckoutPayload;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }
    if (!contactEmail || !businessName) {
      return NextResponse.json(
        { error: "Missing contactEmail or businessName" },
        { status: 400 }
      );
    }

    const API_KEY = process.env.API_KEY;
    const API_URL = "https://client.vivreal.io";

    if (!API_KEY) {
      return NextResponse.json(
        { error: "Server misconfigured: missing API_KEY" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items.data.price.product", "customer_details"],
    });

    const paid =
      session.payment_status === "paid" &&
      (session.status === "complete" || session.status === "open");

    if (!paid) {
      return NextResponse.json({ paid: false, sent: false });
    }

    const customerEmail = session.customer_details?.email;
    if (!customerEmail) {
      return NextResponse.json(
        { error: "Missing customer email" },
        { status: 400 }
      );
    }

    const lineItems = session.line_items?.data ?? [];
    const products = lineItems.map((li) => {
      const name =
        (li.price?.product as any)?.name ??
        li.description ??
        "Item";

      const unitAmount = li.price?.unit_amount ?? 0;
      const quantity = li.quantity ?? 1;

      return {
        name,
        quantity,
        price: (unitAmount / 100).toFixed(2),
      };
    });

    const serverFetch = createServerFetchEdge({
      req,
      baseURL: API_URL,
      timeoutMs: 15000,
      requestId,
      logger: (msg, meta) => edgeLogger?.info?.(msg, meta),
    });

    const upstreamPath = "/tenant/sendOrderPlacedEmail";
    const res = await serverFetch(upstreamPath, {
      method: "POST",
      headers: {
        Authorization: API_KEY,
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
        products,
        contactEmail,
        businessName,
        customerEmail
      }),
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      edgeLogger?.error?.("Upstream email send failed", {
        requestId,
        status: res.status,
        body: bodyText.slice(0, 2000),
      });

      return NextResponse.json(
        { paid: true, sent: false, error: "Upstream email send failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({ paid: true, sent: true });
  } catch (err: any) {
    edgeLogger?.error?.("Confirm checkout failed", {
      requestId,
      error: err?.message ?? String(err),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}