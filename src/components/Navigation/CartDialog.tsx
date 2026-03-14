"use client";

import { useMemo, useState } from "react";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import type { CartDialogProps, CartItem } from "@/types/Cart";
import { handleCheckout } from "@/lib/utils/cartUtils";

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CartDialog({ open, onClose }: CartDialogProps) {
  const { cart, setCart, setOpenCartMenu } = useCartContext();
  const siteData = useSiteData();

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";
  const businessInfo = siteData?.businessInfo || null;

  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const itemsArray = useMemo(() => {
    const entries = cart ? Object.entries(cart) : [];
    return entries.map(([id, item]) => ({ id, ...item }));
  }, [cart]);

  const resolvePrice = (item: CartItem) => {
    return typeof item?.price === "object" && item?.variant
      ? (item.price as unknown as Record<string, string>)[item.variant]
      : item?.price;
  };

  const subtotal = useMemo(() => {
    return itemsArray.reduce(
      (acc, item) => acc + (Number(resolvePrice(item)) || 0) * (item.quantity || 0),
      0
    );
  }, [itemsArray]);

  const totalQty = useMemo(() => {
    return itemsArray.reduce((acc, item) => acc + (item.quantity || 0), 0);
  }, [itemsArray]);

  const setQty = (productId: string, nextQty: number) => {
    const next = { ...(cart || {}) };
    if (nextQty <= 0) {
      delete next[productId];
    } else if (next[productId]) {
      next[productId] = { ...next[productId], quantity: nextQty };
    }
    setCart(next);
  };

  const onCheckout = async () => {
    setLoadingCheckout(true);
    try {
      await handleCheckout({
        cart,
        requiresShipping: !!businessInfo?.shipping,
        originUrl: window.location.origin,
      });
      setOpenCartMenu(false);
    } catch {
      // checkout redirect failed
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        onClick={() => !loadingCheckout && onClose?.()}
        aria-label="Close cart backdrop"
      />

      <section
        role="dialog"
        aria-modal="true"
        className="absolute inset-x-0 bottom-0 h-[85svh] rounded-t-3xl bg-[var(--surface,#fff)] text-[var(--text-primary,#0b1220)] shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[420px] md:rounded-none flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-black/10 bg-[var(--surface,#fff)] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-black/5 overflow-hidden flex items-center justify-center">
                {siteLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={siteLogo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBag className="h-5 w-5 opacity-70" />
                )}
              </div>
              <div className="leading-tight">
                <div className="text-base font-semibold">Your cart</div>
                <div className="text-xs text-black/55">
                  {totalQty
                    ? `${totalQty} item${totalQty === 1 ? "" : "s"}`
                    : "No items yet"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => !loadingCheckout && onClose?.()}
              className="h-9 w-9 cursor-pointer rounded-xl border border-black/10 bg-white/70 hover:bg-white"
              aria-label="Close cart"
            >
              <X className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {itemsArray.length === 0 ? (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-black/5 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 opacity-70" />
              </div>
              <div className="text-sm font-semibold">Your cart is empty</div>
              <div className="mt-1 text-xs text-black/55">
                Add something you love and it&apos;ll show up here.
              </div>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="mt-4 h-10 px-4 cursor-pointer rounded-xl border border-black/10 bg-white hover:bg-black/5 text-sm font-medium"
              >
                Keep shopping
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {itemsArray.map((item) => {
                const priceEach = Number(resolvePrice(item)) || 0;
                const line = priceEach * (item.quantity || 0);
                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm"
                  >
                    <div className="flex gap-3">
                      <div className="h-16 w-16 rounded-xl bg-black/5 overflow-hidden flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item?.imageUrl || siteLogo}
                          alt={item?.name || "Cart item"}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {item?.name}
                            </div>
                            <div className="mt-1 text-xs text-black/60">
                              {currency(priceEach)}{" "}
                              <span className="text-black/35">&bull;</span>{" "}
                              <span className="text-black/70">
                                {currency(line)}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="h-8 w-8 cursor-pointer rounded-xl border border-black/10 bg-white hover:bg-black/5"
                            onClick={() => setQty(item.id, 0)}
                            aria-label="Remove item"
                          >
                            <Trash2 className="mx-auto h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <div className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1">
                            <button
                              type="button"
                              className="h-7 w-7 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                              disabled={loadingCheckout}
                              onClick={() =>
                                setQty(item.id, (item.quantity || 0) - 1)
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus className="mx-auto h-4 w-4" />
                            </button>
                            <div className="min-w-8 text-center text-sm font-semibold">
                              {item.quantity || 0}
                            </div>
                            <button
                              type="button"
                              className="h-7 w-7 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                              disabled={loadingCheckout}
                              onClick={() =>
                                setQty(item.id, (item.quantity || 0) + 1)
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus className="mx-auto h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-xs text-black/55">
                            {businessInfo?.shipping
                              ? "Shipping calculated at checkout"
                              : "No shipping"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-black/10 bg-[var(--surface,#fff)] px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-black/60">Subtotal</div>
            <div className="font-semibold">{currency(subtotal)}</div>
          </div>

          <button
            type="button"
            onClick={onCheckout}
            disabled={!itemsArray.length || loadingCheckout}
            className="mt-3 h-11 w-full rounded-2xl cursor-pointer font-semibold disabled:opacity-60 disabled:cursor-not-allowed text-[var(--text-inverse,#fff)] bg-[var(--primary,#365b99)] hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2"
          >
            {loadingCheckout ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Starting checkout&hellip;</span>
              </>
            ) : (
              <span>Proceed to checkout</span>
            )}
          </button>

          <div className="mt-2 text-[11px] text-black/50 text-center">
            You&apos;ll be redirected to a secure Stripe checkout.
          </div>
        </div>
      </section>
    </div>
  );
}
