/**
 * The order identifier a checkout success page may forward for the order
 * confirmation email (`/api/checkout/confirm`, then VR_Client_API
 * `sendOrderPlacedEmail`).
 *
 *   - Stripe: the Checkout Session id, `cs_` plus word characters.
 *   - Square: the order id. VR_Client_API now points a Square payment link's
 *     redirect at `/checkoutsuccess?session_id=<Square order id>` (store
 *     checkout refresh, 2026-10-07). Square order ids are alphanumeric.
 *
 * Square buyers used to come back to a bare `/checkoutsuccess`, and this route
 * accepted only `cs_`, so a Square buyer never got a receipt. Both shapes are
 * pinned to a strict charset because the value lands in an upstream API path,
 * and VR_Client_API refuses each shape on the other provider's store. "Exactly
 * once" is unchanged: the trigger posts each id once per page, and
 * VR_Client_API records a sent confirmation per order (Stripe on the
 * PaymentIntent, Square in `order_mail_claims`) and answers `already-sent`.
 */
const STRIPE_SESSION_ID = /^cs_[A-Za-z0-9_]{1,240}$/;
const SQUARE_ORDER_ID = /^[A-Za-z0-9]{10,64}$/;

export function isOrderConfirmationId(value: unknown): value is string {
  return typeof value === "string" && (STRIPE_SESSION_ID.test(value) || SQUARE_ORDER_ID.test(value));
}

/**
 * Whether VR_Client_API's `sendOrderPlacedEmail` answer confirms the order
 * (RW5). Its envelope is `{ success, data: { sent, reason } }`, and it answers
 * `sent: true` (mail queued) or `reason: "already-sent"` only AFTER it has
 * read the order from the merchant's own Stripe or Square account and found it
 * paid. Everything else (`not-paid`, `provider-not-supported`, a 4xx for an
 * unknown order, an unreadable body) is not a confirmation.
 */
export function isConfirmedOrderAnswer(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return false;
  const { sent, reason } = data as { sent?: unknown; reason?: unknown };
  return sent === true || reason === "already-sent";
}

/**
 * What the success page may tell the shopper about an order (TB-5 final pass).
 *
 *   - `confirmed`: VR_Client_API read the order from the merchant's own Stripe
 *     or Square account and found it paid.
 *   - `no-paid-order`: it positively answered that there is no such paid
 *     order on this store (an unknown id, or one that is not paid).
 *   - `unverified`: nobody could check. No id on the return link (a Square
 *     buyer when the redirect missed), a failed or timed out call, an
 *     unsupported provider, an unreadable answer. A paying buyer lands here,
 *     so the page must not say the order does not exist.
 */
export type OrderCheck = "confirmed" | "no-paid-order" | "unverified";

const ORDER_CHECKS: ReadonlySet<unknown> = new Set<OrderCheck>(["confirmed", "no-paid-order", "unverified"]);

export function isOrderCheck(value: unknown): value is OrderCheck {
  return ORDER_CHECKS.has(value);
}

/** A 2xx answer from `sendOrderPlacedEmail`. Only `not-paid` is a positive no. */
export function orderCheckFromAnswer(body: unknown): OrderCheck {
  if (isConfirmedOrderAnswer(body)) return "confirmed";
  if (typeof body !== "object" || body === null) return "unverified";
  const data = (body as { data?: unknown }).data;
  if (typeof data !== "object" || data === null) return "unverified";
  return (data as { reason?: unknown }).reason === "not-paid" ? "no-paid-order" : "unverified";
}

/**
 * A refused answer. 404 is VR_Client_API's "That order could not be found."
 * (an unknown id, another location's order, or the other provider's id
 * shape). Every other status (400 no key, 409, 5xx) is a fault on our side,
 * not news about the order.
 */
export function orderCheckFromRefusal(status: number): OrderCheck {
  return status === 404 ? "no-paid-order" : "unverified";
}
