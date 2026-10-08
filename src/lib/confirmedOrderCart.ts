/**
 * Whether landing on the checkout success page should empty the cart (RW3-6).
 *
 * The cart lives in this app (`contexts/CartContext.tsx`, IndexedDB with a
 * 24 hour expiry) and nothing ever emptied it after a purchase, so a buyer who
 * saw "Order confirmed!" still had the bought item in the bag, across reloads,
 * inviting a second purchase.
 *
 * A CONFIRMED ORDER IS ONE THE SERVER CONFIRMED (RW5, 2026-10-08). Stripe
 * returns to `/checkoutsuccess?session_id=cs_...` and Square to
 * `/checkoutsuccess?session_id=<order id>`. An id that merely LOOKS valid is
 * not enough: a crafted link would empty a shopper's cart. So the id is posted
 * to `/api/checkout/confirm` (the same request that sends the receipt, shared
 * through `lib/confirmOrder.ts`), and the cart is cleared only when that
 * answers `confirmed: true`, which VR_Client_API gives only after reading the
 * order from the merchant's own Stripe or Square account and finding it paid.
 * Everything else keeps the cart:
 *   - a malformed id, or none (a bare `/checkoutsuccess`), is never posted;
 *   - an unpaid or unknown order, or one from another store, is not confirmed;
 *   - a failed or unanswered request is not confirmed (the safe side is a
 *     full bag);
 *   - a cancelled Stripe checkout lands on `/checkoutcancel`, which never
 *     renders the component that calls this.
 *
 * ONCE PER ORDER PER TAB. The id is recorded in sessionStorage, so reloading
 * the confirmation page after shopping again does not throw away the new bag.
 * Where storage is unavailable (some private modes throw on access), the cart
 * is cleared on every visit to that order's page: the buyer has already paid
 * for what was in it, so an empty bag is the safe side.
 */
import { isOrderConfirmationId, type OrderCheck } from "./orderConfirmationId.ts";

export const CART_CLEARED_KEY_PREFIX = "vr-cart-cleared:";

export type ClearedOrderStore = Pick<Storage, "getItem" | "setItem">;

/**
 * Clears the cart when, and only when, the server confirms the order on the
 * URL, at most once per order per tab. Resolves to whether it cleared.
 */
export async function clearCartIfOrderConfirmed({
  search,
  confirm,
  storage,
  clear,
}: {
  search: string;
  confirm: (orderId: string) => Promise<OrderCheck>;
  storage: ClearedOrderStore | null;
  clear: () => void;
}): Promise<boolean> {
  const orderId = new URLSearchParams(search).get("session_id");
  if (!isOrderConfirmationId(orderId)) return false;
  if ((await confirm(orderId)) !== "confirmed") return false;
  if (!firstClearForOrder(orderId, storage)) return false;
  clear();
  return true;
}

function firstClearForOrder(orderId: string, storage: ClearedOrderStore | null): boolean {
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
