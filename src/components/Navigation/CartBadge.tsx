"use client";

import { ShoppingCart } from "lucide-react";
import { useOptionalCart } from "@/contexts/CartContext";

export default function CartBadge() {
  const cartCtx = useOptionalCart();

  if (!cartCtx) return null;

  const { cart, setOpenCartMenu, cartHydrated } = cartCtx;

  const totalItems = Object.values(cart).reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // Don't render until cart is hydrated from IndexedDB
  if (!cartHydrated) return null;

  return (
    <button
      type="button"
      onClick={() => setOpenCartMenu(true)}
      className="relative p-2 text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
      aria-label={`Shopping cart with ${totalItems} items`}
    >
      <ShoppingCart className="h-5 w-5" />
      {totalItems > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-black px-1 text-[10px] font-semibold text-white leading-none">
          {totalItems > 99 ? "99+" : totalItems}
        </span>
      )}
    </button>
  );
}
