/**
 * What a validated promo code takes off the bag, for the cart's preview
 * (RW3-4 tail, 2026-10-08).
 *
 * VR_Client_API can answer `valid: true` for a code that takes nothing off
 * this cart (a fixed amount on a free line, a percentage that rounds to zero,
 * a scope the items only partly meet). The cart used to call any valid code
 * "applied", so the shopper saw "SAVE10 applied" beside an unchanged total.
 * A code is shown as applied only when this answers more than zero; otherwise
 * the shopper reads COUPON_NO_EFFECT_COPY and no code rides into checkout.
 */
/**
 * TB-7 (re-walk B): the case the walk hit is a sale price that already takes
 * off more than the code would (VR_Client_API applies the larger of the two,
 * `pickLargerDiscount`), and "does not apply" read as a bad code. The preview
 * carries no reason for a zero, so the line names the likely cause as a
 * possibility rather than claiming it.
 */
export const COUPON_NO_EFFECT_COPY =
  "This code would not lower your total. A sale price on these items may already save you more.";

/**
 * The preview discount in DOLLARS, clamped to [0, subtotal].
 *
 * `newSubtotalCents` is VR_Client_API's `newSubtotal`, in CENTS (it prices off
 * Stripe unit_amount), while the cart's `subtotal` is in DOLLARS. A missing or
 * non-finite value means no discount can be shown, so it answers 0. The figure
 * is a PREVIEW; Stripe applies the authoritative amount at checkout.
 */
export function couponPreviewDiscount(newSubtotalCents: unknown, subtotal: number): number {
  if (typeof newSubtotalCents !== "number" || !Number.isFinite(newSubtotalCents)) return 0;
  if (!Number.isFinite(subtotal) || subtotal <= 0) return 0;
  return Math.min(subtotal, Math.max(0, subtotal - newSubtotalCents / 100));
}
