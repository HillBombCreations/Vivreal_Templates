"use client";

import { useEffect } from "react";
import { useOptionalCart } from "@/contexts/CartContext";
import { shouldClearCartForOrder, type ClearedOrderStore } from "@/lib/confirmedOrderCart";

/**
 * Empties the cart once a buyer lands back from a completed checkout (RW3-6).
 * Which landings count as a confirmed order is decided, and tested, in
 * `lib/confirmedOrderCart.ts`; this only wires it to the cart.
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
    if (shouldClearCartForOrder(window.location.search, storage)) setCart({});
  }, [cartHydrated, setCart]);

  return null;
}
