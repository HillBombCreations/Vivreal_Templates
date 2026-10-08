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
