"use client";

import { useEffect } from "react";
import { useOptionalCart } from "@/contexts/CartContext";
import { clearCartIfOrderConfirmed, type ClearedOrderStore } from "@/lib/confirmedOrderCart";
import { confirmOrder } from "@/lib/confirmOrder";

/**
 * Empties the cart once a buyer lands back from a completed checkout (RW3-6),
 * and only after `/api/checkout/confirm` confirms that order paid (RW5). The
 * decision is made, and tested, in `lib/confirmedOrderCart.ts`; this only
 * wires it to the cart. `setCart` is a state setter, so an answer that lands
 * after this unmounts still clears, which is right: the bag was paid for.
 *
 * It waits for `cartHydrated`. The provider reads the stored cart from
 * IndexedDB asynchronously and then REPLACES the in-memory cart with it, so a
 * clear issued before that read finishes would be overwritten by the very
 * items it removed. After hydration, `setCart({})` also persists, because the
 * provider writes every change back to IndexedDB.
 *
 * Rendered beside OrderConfirmationTrigger on the checkout-success format
 * only, for the same reasons: the success page is ISR-cached HTML, so only a
 * browser effect is tied to the buyer in front of it. A site without a cart
 * (no payments binding) has no provider, and this does nothing.
 */
export default function ClearCartOnConfirmedOrder() {
  const cartContext = useOptionalCart();
  const cartHydrated = cartContext?.cartHydrated ?? false;
  const setCart = cartContext?.setCart;

  useEffect(() => {
    if (!cartHydrated || !setCart) return;
    let storage: ClearedOrderStore | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      // Access itself can throw (blocked storage). See confirmedOrderCart.ts
      // for why the cart is still cleared without it.
      storage = null;
    }
    void clearCartIfOrderConfirmed({
      search: window.location.search,
      confirm: confirmOrder,
      storage,
      clear: () => setCart({}),
    });
  }, [cartHydrated, setCart]);

  return null;
}
