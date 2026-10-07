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
