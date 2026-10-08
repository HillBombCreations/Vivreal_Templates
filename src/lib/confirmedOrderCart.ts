/**
 * Whether landing on the checkout success page should empty the cart (RW3-6).
 *
 * The cart lives in this app (`contexts/CartContext.tsx`, IndexedDB with a
 * 24 hour expiry) and nothing ever emptied it after a purchase, so a buyer who
 * saw "Order confirmed!" still had the bought item in the bag, across reloads,
 * inviting a second purchase.
 *
 * A CONFIRMED ORDER IS ONE WITH AN ORDER ID ON THE URL. Stripe returns to
 * `/checkoutsuccess?session_id=cs_...` and Square to
 * `/checkoutsuccess?session_id=<order id>`, the same ids the receipt trigger
 * forwards (`isOrderConfirmationId`). Everything else keeps the cart:
 *   - a cancelled Stripe checkout lands on `/checkoutcancel`, which never
 *     renders the component that calls this;
 *   - a failed or abandoned payment never reaches the success page at all;
 *   - a bare `/checkoutsuccess` (someone opening the page, or a Square link
 *     whose redirect could not be stamped with its order id) names no order,
 *     so it is not treated as one.
 *
 * ONCE PER ORDER PER TAB. The id is recorded in sessionStorage, so reloading
 * the confirmation page after shopping again does not throw away the new bag.
 * Where storage is unavailable (some private modes throw on access), the cart
 * is cleared on every visit to that order's page: the buyer has already paid
 * for what was in it, so an empty bag is the safe side.
 */
import { isOrderConfirmationId } from "./orderConfirmationId.ts";

export const CART_CLEARED_KEY_PREFIX = "vr-cart-cleared:";

export type ClearedOrderStore = Pick<Storage, "getItem" | "setItem">;

export function shouldClearCartForOrder(search: string, storage: ClearedOrderStore | null): boolean {
  const orderId = new URLSearchParams(search).get("session_id");
  if (!isOrderConfirmationId(orderId)) return false;
  if (!storage) return true;
  const key = `${CART_CLEARED_KEY_PREFIX}${orderId}`;
  try {
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
  } catch {
    // Storage refused the read or the write (quota, private mode). The order
    // is still confirmed, so the cart is still cleared; only the once-per-tab
    // memory is lost, as described above.
  }
  return true;
}
