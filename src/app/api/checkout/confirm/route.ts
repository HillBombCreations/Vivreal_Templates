import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/**
 * Tell VR_Client_API that a checkout completed, so it can mail the receipt.
 *
 * ── WHY THIS ROUTE EXISTS AT ALL ─────────────────────────────────────
 *
 * Until now, a buyer paid and nobody was told. Not the buyer, not the shop.
 * `POST /tenant/sendOrderPlacedEmail` has existed on VR_Client_API the whole
 * time and took zero requests in thirty days while checkouts succeeded,
 * because nothing in this repo or in the renderer ever called it. The success
 * page meanwhile promised "You'll receive a confirmation email shortly".
 * This route is the sentence becoming true.
 *
 * A version of it was written once, on 2026-01-07, at this exact path
 * (commit fb30919, as `route.tsx`). It lives only on the unmerged branch
 * `feat/cdn-media-urls-ecommerce` and never reached `main`. It also could not
 * have worked: it called `stripe.checkout.sessions.retrieve` here, with one
 * global `STRIPE_SECRET_KEY`, and a customer's session lives in THAT
 * CUSTOMER's Stripe account. Every lookup would have 404ed.
 *
 * ── SO THIS ROUTE DOES NOT TOUCH STRIPE ──────────────────────────────
 *
 * It forwards a session id and nothing else. VR_Client_API resolves the
 * group's own Stripe key, retrieves the session, checks it was actually paid,
 * and reads the cart, the amount and the buyer's address off it. It also
 * resolves the shop's name, owner inbox and palette from the site document.
 *
 * That split is the point. Everything that decides WHO GETS MAILED and WHAT
 * IT SAYS is resolved server-side from a credential this app does not hold.
 * Nothing a browser can send changes a recipient or a word of the email.
 * `siteId` comes from `SITE_ID`, an Amplify build env var, not from the body.
 *
 * ── AND WHY THE ANSWER IS ALWAYS SHAPED THE SAME ─────────────────────
 *
 * The caller is a fire-and-forget effect on a page the shopper is already
 * looking at. There is no UI for a failure here and there should not be: the
 * money is taken and the order is real whatever this returns, so a red banner
 * about email would frighten somebody whose purchase went through fine. The
 * response carries `sent` for observability and nothing the page renders.
 */

/** Stripe session ids are `cs_` plus word characters. Refuse anything else. */
const SESSION_ID = /^cs_[A-Za-z0-9_]{1,240}$/;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ sent: false, reason: "bad-request" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ sent: false, reason: "bad-request" }, { status: 400 });
  }

  const { sessionId } = body as Record<string, unknown>;

  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return NextResponse.json({ sent: false, reason: "bad-session" }, { status: 400 });
  }

  const apiKey = process.env.API_KEY;
  const siteId = process.env.SITE_ID;
  const clientApiUrl =
    process.env.NEXT_PUBLIC_CLIENT_API ?? "https://client.vivreal.io";

  // `SITE_ID` is 'preview' in local and preview builds, where there is no real
  // site document and no real order. Refusing here keeps a preview from
  // reaching a live API with a nonsense id, and the upstream would 400 on the
  // ObjectId shape anyway.
  if (!apiKey || !siteId || siteId === "preview") {
    return NextResponse.json({ sent: false, reason: "not-configured" }, { status: 200 });
  }

  try {
    const res = await fetch(`${clientApiUrl}/tenant/sendOrderPlacedEmail`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      cache: "no-store",
      body: JSON.stringify({ sessionId, siteId }),
    });

    // Never log or return the upstream body. On this route it is small, but
    // the rule is the one the sibling checkout route pins: an upstream body
    // can quote back the value it objected to, and here that value is a
    // session id, which is an order-scoped identifier.
    if (!res.ok) {
      console.error("[checkout/confirm] upstream refused, status:", res.status);
      return NextResponse.json({ sent: false, reason: "upstream" }, { status: 200 });
    }

    return NextResponse.json({ sent: true }, { status: 200 });
  } catch {
    // The order is already paid for and recorded. A mail-infrastructure blip
    // must not turn the shopper's confirmation page into an error page, so
    // this is logged and swallowed deliberately rather than by omission. The
    // send itself is alarmed upstream: VR_Client_API puts both messages on
    // `vivreal-email-queue`, which has stale, DLQ-depth and consumer-error
    // alarms on it.
    console.error("[checkout/confirm] upstream request failed");
    return NextResponse.json({ sent: false, reason: "unreachable" }, { status: 200 });
  }
}
