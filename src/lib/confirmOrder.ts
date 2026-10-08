/**
 * The ONE `/api/checkout/confirm` request a success page makes per order, and
 * what it said about that order (RW5; three outcomes since the TB-5 final
 * pass, see `OrderCheck` in `orderConfirmationId.ts`).
 *
 * Two components need it: OrderConfirmationTrigger (the receipt email) and
 * ClearCartOnConfirmedOrder (which empties the bag only for an order the
 * server has confirmed paid, so a crafted `?session_id=` cannot empty a
 * shopper's cart). They share this promise, so the page still posts once.
 *
 * Module scope, deliberately not persisted: a genuine reload starts empty and
 * posts again, which is the retry for a failed receipt (VR_Client_API answers
 * `already-sent` after a success). A network failure removes the entry, so a
 * remount can retry; any other answer is final for this page load.
 */

import { isOrderCheck, type OrderCheck } from "./orderConfirmationId.ts";

/** The part of a fetch Response this reads. */
export type ConfirmResponse = { ok: boolean; json: () => Promise<unknown> };
export type PostConfirm = (sessionId: string) => Promise<ConfirmResponse>;

const postConfirm: PostConfirm = (sessionId) =>
  // `keepalive` so the request survives the shopper navigating away from the
  // confirmation page before it completes, which is what people do after buying.
  fetch("/api/checkout/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
    keepalive: true,
  });

const answers = new Map<string, Promise<OrderCheck>>();

/** The route's `outcome`. A body without one (a tab open across a deploy) reads `confirmed`. */
function orderCheckFromRoute(body: unknown): OrderCheck {
  if (typeof body !== "object" || body === null) return "unverified";
  // Narrowed field by field below; the cast only names the two fields read.
  const { outcome, confirmed } = body as { outcome?: unknown; confirmed?: unknown };
  if (isOrderCheck(outcome)) return outcome;
  return confirmed === true ? "confirmed" : "unverified";
}

export function confirmOrder(sessionId: string, post: PostConfirm = postConfirm): Promise<OrderCheck> {
  const existing = answers.get(sessionId);
  if (existing) return existing;
  const answer = post(sessionId)
    .then(async (res) => {
      if (!res.ok) return "unverified" as const;
      return orderCheckFromRoute(await res.json());
    })
    .catch(() => {
      // Swallowed with a reason: the order is paid for and recorded whatever
      // happens to this request, and there is nothing the shopper could do.
      // The route logs refusals server-side and the mail queue is alarmed.
      // Unverified means the cart is kept, the safe side. The entry is
      // removed so a remount can retry, the one case where retrying is free.
      answers.delete(sessionId);
      return "unverified" as const;
    });
  answers.set(sessionId, answer);
  return answer;
}
