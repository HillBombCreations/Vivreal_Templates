"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Cart, CartContextValue } from "@/types/Cart";
import { isStoredPromoCode, type StoredPromoCode } from "@/lib/promoCodeRestore";

/* ------------------------------------------------------------------ */
/*  IndexedDB helpers — no external deps                              */
/* ------------------------------------------------------------------ */

const DB_NAME = "vivreal-cart";
const STORE_NAME = "cart";
const CART_KEY = "current";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredCart {
  cart: Cart;
  /** TB-6: the applied promo code, kept with the cart it was validated for. */
  promoCode?: StoredPromoCode | null;
  timestamp: number;
}

interface CartRecord {
  cart: Cart;
  promoCode: StoredPromoCode | null;
}

const EMPTY_RECORD: CartRecord = { cart: {}, promoCode: null };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCart(): Promise<CartRecord> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CART_KEY);
      req.onsuccess = () => {
        const stored = req.result as StoredCart | undefined;
        if (stored && Date.now() - stored.timestamp < EXPIRY_MS) {
          resolve({
            cart: stored.cart,
            // Records written before TB-6 carry no code; a malformed one is ignored.
            promoCode: isStoredPromoCode(stored.promoCode) ? stored.promoCode : null,
          });
        } else {
          resolve(EMPTY_RECORD);
        }
      };
      req.onerror = () => resolve(EMPTY_RECORD);
    });
  } catch {
    return EMPTY_RECORD;
  }
}

async function writeCart(cart: Cart, promoCode: StoredPromoCode | null): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ cart, promoCode, timestamp: Date.now() } satisfies StoredCart, CART_KEY);
  } catch {
    // silently fail — cart will be recreated
  }
}

/* ------------------------------------------------------------------ */
/*  Context                                                           */
/* ------------------------------------------------------------------ */

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [openCartMenu, setOpenCartMenu] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [promoCode, setPromoCode] = useState<StoredPromoCode | null>(null);

  // Hydrate from IndexedDB on mount. The cart and its promo code are set in
  // the same batch, so no render ever sees one without the other.
  useEffect(() => {
    readCart().then((stored) => {
      setCart(stored.cart);
      setPromoCode(stored.promoCode);
      setCartHydrated(true);
    });
  }, []);

  // Persist to IndexedDB whenever the cart or its code changes (after hydration)
  useEffect(() => {
    if (cartHydrated) {
      writeCart(cart, promoCode);
    }
  }, [cart, promoCode, cartHydrated]);

  return (
    <CartContext.Provider
      value={{ cart, setCart, openCartMenu, setOpenCartMenu, cartHydrated, promoCode, setPromoCode }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCartContext must be used within a CartProvider");
  }
  return ctx;
}

/**
 * Optional cart hook — returns null if CartProvider isn't mounted.
 * Safe to use in components that render on both ecommerce and non-ecommerce sites.
 */
export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}
