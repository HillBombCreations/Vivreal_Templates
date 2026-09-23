"use client";

import { useEffect } from "react";

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

/**
 * Session ids this browsing context has already posted.
 *
 * Covers a remount and React's development double-invoked effect. It is
 * module scope, so a genuine page RELOAD starts empty and posts again, and
 * that is deliberate rather than an oversight: if the first attempt failed,
 * the reload is the retry that gets the buyer their receipt. A reload after a
 * SUCCESS costs one request and sends nothing, because VR_Client_API stamps
 * the Stripe PaymentIntent once the mail is queued and answers `already-sent`
 * on every attempt after that. Persisting this in sessionStorage would save
 * that one request and cost the retry, which is the wrong way round.
 */
const attempted = new Set<string>();

export default function OrderConfirmationTrigger() {
  useEffect(() => {
    // Read the URL HERE, not in a `useState` initializer. An initializer runs
    // on the server during SSR, where there is no `window`, and its value is
    // then kept forever because React never re-runs it on the client.
    const sessionId = new URLSearchParams(window.location.search).get("session_id");

    // Square sends the buyer back to this same page with no identifier on it,
    // and somebody can simply open the page. Both are normal; neither is an
    // order to confirm.
    if (!sessionId || attempted.has(sessionId)) return;
    attempted.add(sessionId);

    // Deliberately not awaited and deliberately not surfaced. `keepalive` so
    // the request survives the shopper navigating away from the confirmation
    // page before it completes, which is exactly what people do after buying.
    fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
      keepalive: true,
    }).catch(() => {
      // Swallowed with a reason: the order is paid for and recorded whatever
      // happens to this request, and there is no action the shopper could
      // take. Letting it reject unhandled would put a red line in their
      // console on a page that is telling them everything went fine.
      //
      // The send is observable where it can actually be acted on: the route
      // logs the refusal server-side, and the queue behind it carries stale,
      // DLQ-depth and consumer-error alarms.
      //
      // The id is REMOVED from the attempted set so a remount can retry. A
      // network failure is the one case where trying again is free and might
      // work.
      attempted.delete(sessionId);
    });
  }, []);

  return null;
}
