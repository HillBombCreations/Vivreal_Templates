"use client";

import { useEffect } from "react";
import { confirmOrder } from "@/lib/confirmOrder";

/**
 * Fires the order confirmation email, once, when a buyer lands back from Stripe.
 *
 * ── WHY A CLIENT EFFECT AND NOT THE SERVER RENDER ────────────────────
 *
 * `/checkoutsuccess` is a normal Studio page rendered by `[slug]/page.tsx`,
 * which is ISR with `revalidate = 300`. Its HTML is cached and shared. A side
 * effect in that render would either fire on a cache MISS for whoever happened
 * to trigger the revalidation, or not fire at all for everybody served the
 * cached copy, and in neither case would it be tied to the buyer in front of
 * it. Reading `searchParams` there would also opt the slug out of prerendering
 * for every shopper, not just the one with an order.
 *
 * The effect runs in the browser, after the page paints, whether that HTML
 * came from the cache or not. It is the only place in this app that knows
 * THIS person just completed THIS checkout.
 *
 * ── AND WHY THIS COMPONENT RENDERS NOTHING ───────────────────────────
 *
 * The confirmation card is the renderer's `CheckoutResultTemplate`, which is
 * shared with the portal Studio preview and is deliberately effect-free. This
 * sits beside it rather than inside it, so the preview keeps rendering a
 * static card and cannot post anything anywhere.
 *
 * There is also nothing to show. Whether the email queued does not change what
 * the shopper should be told: their order went through. A failure here is a
 * mail problem, alarmed on the queue upstream, and is not the buyer's to
 * worry about.
 */

/*
 * Posting at most once per order, and retrying only after a network failure,
 * live in `lib/confirmOrder.ts`, because ClearCartOnConfirmedOrder reads the
 * same answer (RW5). They are module scope there and not persisted, so a
 * genuine page RELOAD posts again: if the first attempt failed, the reload is
 * the retry that gets the buyer their receipt, and after a success
 * VR_Client_API answers `already-sent` and sends nothing.
 */

export default function OrderConfirmationTrigger() {
  useEffect(() => {
    // Read the URL HERE, not in a `useState` initializer. An initializer runs
    // on the server during SSR, where there is no `window`, and its value is
    // then kept forever because React never re-runs it on the client.
    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    // Stripe returns with `cs_...`; Square now returns with its order id
    // (VR_Client_API points the payment link's redirect at it). Somebody can
    // also simply open the page with no id, which is normal and is not an
    // order to confirm. The route checks the id's shape.
    if (!sessionId) return;

    // Deliberately not awaited and deliberately not surfaced: confirmOrder
    // never rejects, and a refusal is logged server-side by the route.
    void confirmOrder(sessionId);
  }, []);

  return null;
}
