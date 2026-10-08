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
 * What the success page may tell the shopper about an order (TB-5 final pass,
 * narrowed 2026-10-08).
 *
 *   - `confirmed`: VR_Client_API read the order from the merchant's own Stripe
 *     or Square account and found it paid.
 *   - `no-paid-order`: the provider positively said this store has NO such
 *     order. Only that, see `orderCheckFromRefusal`.
 *   - `unverified`: anything short of that. No id on the return link, a failed
 *     or timed out call, an unsupported provider, a configuration fault, an
 *     unreadable answer, AND an order that exists but is not paid yet. A
 *     paying buyer lands here, so the page must not say the order is missing.
 */
export type OrderCheck = "confirmed" | "no-paid-order" | "unverified";

const ORDER_CHECKS: ReadonlySet<unknown> = new Set<OrderCheck>(["confirmed", "no-paid-order", "unverified"]);

export function isOrderCheck(value: unknown): value is OrderCheck {
  return ORDER_CHECKS.has(value);
}

/**
 * A 2xx answer from `sendOrderPlacedEmail`. Never a positive no.
 *
 * `not-paid` is NOT news that the order is missing. VR_Client_API answers it
 * for any Stripe session whose `payment_status` is not `paid` and any Square
 * order whose `state` is not `COMPLETED`. That covers a session still open, a
 * completed session whose bank payment is still processing, and a Square order
 * still OPEN (approved but not captured, or pending), all of which a buyer who
 * paid can hit. It also covers expired and cancelled orders, but the answer
 * does not say which, so it reads as "could not check" and the cart is kept.
 */
export function orderCheckFromAnswer(body: unknown): OrderCheck {
  return isConfirmedOrderAnswer(body) ? "confirmed" : "unverified";
}

/**
 * VR_Client_API's sentence for "this store has no such order": an unknown
 * Stripe session (Stripe 404), an unknown Square order, another location's
 * order, or the other provider's id shape. Its handler writes it as
 * `{ success: false, data: null, error }` on a 404.
 */
export const ORDER_NOT_FOUND_ERROR = "That order could not be found.";

/**
 * A refused answer. Only a 404 that carries the order-not-found sentence is a
 * positive no. Every other refusal is a fault on our side, not news about the
 * order: a 404 "That site could not be found." (a misconfigured SITE_ID), a
 * 404 from a gateway or an unknown path (a misconfigured API URL), a 400 with
 * no payment key, a 409, any 5xx. The sentence is matched exactly, so if
 * upstream ever rewords it the page falls back to "could not check", the safe
 * side, rather than telling a buyer their order is missing.
 */
export function orderCheckFromRefusal(status: number, body: unknown): OrderCheck {
  if (status !== 404) return "unverified";
  if (typeof body !== "object" || body === null) return "unverified";
  // The cast only names the one field read; it is compared, never trusted.
  return (body as { error?: unknown }).error === ORDER_NOT_FOUND_ERROR ? "no-paid-order" : "unverified";
}
