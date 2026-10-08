/**
 * Keeping an applied promo code across page loads (TB-6, re-walk B,
 * 2026-10-08).
 *
 * The applied code lived only in CartDialog's component state, so any full
 * page load dropped it while the bag itself survived (IndexedDB, see
 * `contexts/CartContext.tsx`). The shopper saw "Promo code / Apply" and full
 * price again, and checkout charged full price.
 *
 * The code is now stored beside the cart, in the same IndexedDB record, with
 * the cart lines it was validated against. On load it is re-checked with
 * VR_Client_API before it is shown as applied, because a code can expire or
 * hit its limit between visits:
 *   - kept:      still valid and still takes something off; shown as applied;
 *   - dropped:   no longer valid, or no longer takes anything off; removed,
 *                with PROMO_CODE_DROPPED_COPY;
 *   - discard:   the bag changed since it was applied (another tab, a cleared
 *                cart after an order); removed silently, exactly as a cart
 *                change in this tab already removes it;
 *   - unchecked: the check itself failed (network, upstream error). Not shown
 *                as applied and not sent to checkout, but kept in storage so the
 *                next load can try again. Not the shopper's code's fault, so no
 *                "no longer applies" message.
 */
import { couponPreviewDiscount } from "./couponPreview.ts";

export const PROMO_CODE_DROPPED_COPY = "Your promo code no longer applies, so it was removed.";

export type StoredPromoCode = { code: string; linesKey: string };

/** The part of a coupon preview this reads (structural, see cartUtils). */
export type PromoPreview = { valid: boolean; newSubtotal?: number | null; reason?: string };

export type PromoLine = { price: string; quantity: number };

export type PromoRestore =
  | { kind: "kept"; code: string; discount: number }
  | { kind: "dropped" }
  | { kind: "discard" }
  | { kind: "unchecked" };

/**
 * A stable key for the exact cart a code was validated against. Order
 * independent, since the cart is an object keyed by product id.
 */
export function cartLinesKey(lines: readonly PromoLine[]): string {
  return lines
    .map((l) => `${l.price}x${l.quantity}`)
    .sort()
    .join("|");
}

/** Validates the stored value at the IndexedDB boundary. */
export function isStoredPromoCode(value: unknown): value is StoredPromoCode {
  if (typeof value !== "object" || value === null) return false;
  const { code, linesKey } = value as Record<string, unknown>;
  return typeof code === "string" && code.trim().length > 0 && typeof linesKey === "string" && linesKey.length > 0;
}

export async function revalidateStoredPromoCode({
  stored,
  lines,
  subtotal,
  validate,
}: {
  stored: StoredPromoCode;
  lines: readonly PromoLine[];
  subtotal: number;
  validate: (code: string, lines: PromoLine[]) => Promise<PromoPreview>;
}): Promise<PromoRestore> {
  if (lines.length === 0 || stored.linesKey !== cartLinesKey(lines)) return { kind: "discard" };

  let result: PromoPreview;
  try {
    result = await validate(stored.code, [...lines]);
  } catch {
    // A transport failure says nothing about the code. See "unchecked" above.
    return { kind: "unchecked" };
  }
  // cartUtils.validateCoupon maps a non-OK upstream answer to reason "error".
  if (!result.valid && result.reason === "error") return { kind: "unchecked" };

  const discount = result.valid ? couponPreviewDiscount(result.newSubtotal, subtotal) : 0;
  return discount > 0 ? { kind: "kept", code: stored.code, discount } : { kind: "dropped" };
}
