/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useContext, useMemo, useState } from "react";
import axios from "axios";
import CartContext from "@/contexts/CartContext";
import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { SiteData } from "@/types/SiteData";

type CartDialogProps = {
  open: boolean;
  onClose?: () => void;
  siteData: SiteData
};

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

export default function CartDialog({ open, onClose, siteData }: CartDialogProps) {
  const { cartItems, setCartItems } = useContext(CartContext) as any;
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl;
  const businessInfo = siteData?.businessInfo;
  const integrationInfo = siteData?.integrationInfo;

  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const key =
    process.env.NEXT_PUBLIC_CLIENT_KEY ||
    (typeof window !== "undefined" ? (window as any)?.__VIVREAL_CLIENT_KEY : undefined);

  const itemsArray = useMemo(() => {
    const entries = cartItems ? Object.entries(cartItems) : [];
    return entries.map(([id, item]: any) => ({ id, ...item }));
  }, [cartItems]);

  const resolvePrice = (item: any) => {
    return typeof item?.price === "object" && item?.variant ? item.price[item.variant] : item?.price;
  };

  const resolvePriceId = (item: any) => {
    return typeof item?.priceID === "object" && item?.variant ? item.priceID[item.variant] : item?.priceID;
  };

  const subtotal = useMemo(() => {
    return itemsArray.reduce((acc, item) => acc + (Number(resolvePrice(item)) || 0) * (item.quantity || 0), 0);
  }, [itemsArray]);

  const totalQty = useMemo(() => {
    return itemsArray.reduce((acc, item) => acc + (item.quantity || 0), 0);
  }, [itemsArray]);

  const setQty = (productId: string, nextQty: number) => {
    const next = { ...(cartItems || {}) };
    if (nextQty <= 0) {
      delete next[productId];
    } else if (next[productId]) {
      next[productId] = { ...next[productId], quantity: nextQty };
    }
    setCartItems(next);
  };

  const handleCheckout = async () => {
    if (!itemsArray.length) return;

    setLoadingCheckout(true);
    try {
      const products = itemsArray.map((item: any) => ({
        price: resolvePriceId(item),
        quantity: item.quantity,
        name: item.name,
      }));

     const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          products: products,
          businessName: businessInfo?.name,
          contactEmail: businessInfo?.contactInfo?.email,
          requiresShipping: !!businessInfo?.shipping,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await res.json();

      if (data && !(data?.status && data.status === 400)) {
        console.log('DATA', data);
        // window.location.replace(data);
      }
    } catch (e) {
      console.error("[CartDialog] checkout error:", e);
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
        className={`
          absolute inset-x-0 bottom-0 h-[85svh]
          rounded-t-3xl bg-[var(--surface,#fff)]
          text-[var(--text-primary,#0b1220)] shadow-2xl
          md:inset-y-0 md:right-0 md:left-auto md:h-full md:w-[420px] md:rounded-none
          flex flex-col
        `}
      >
        <div className="sticky top-0 z-10 border-b border-black/10 bg-[var(--surface,#fff)] px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-2xl bg-black/5 overflow-hidden flex items-center justify-center"
                aria-hidden="true"
              >
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
                  {totalQty ? `${totalQty} item${totalQty === 1 ? "" : "s"}` : "No items yet"}
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

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {itemsArray.length === 0 ? (
            <div className="mt-10 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-black/5 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 opacity-70" />
              </div>
              <div className="text-sm font-semibold">Your cart is empty</div>
              <div className="mt-1 text-xs text-black/55">Add something you love and it’ll show up here.</div>
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
              {itemsArray.map((item: any) => {
                const priceEach = Number(resolvePrice(item)) || 0;
                const line = priceEach * (item.quantity || 0);
                return (
                  <div
                    key={item.priceID}
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
                            <div className="truncate text-sm font-semibold">{item?.name}</div>
                            {!!item?.variant && (
                              <div className="mt-0.5 text-xs text-black/55">Variant: {item.variant}</div>
                            )}
                            <div className="mt-1 text-xs text-black/60">
                              {currency(priceEach)} <span className="text-black/35">•</span>{" "}
                              <span className="text-black/70">{currency(line)}</span>
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
                              onClick={() => setQty(item.id, (item.quantity || 0) - 1)}
                              aria-label="Decrease quantity"
                            >
                              <Minus className="mx-auto h-4 w-4" />
                            </button>

                            <div className="w-8 text-center text-sm font-semibold">
                              {item.quantity || 0}
                            </div>

                            <button
                              type="button"
                              className="h-7 w-7 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                              disabled={loadingCheckout}
                              onClick={() => setQty(item.id, (item.quantity || 0) + 1)}
                              aria-label="Increase quantity"
                            >
                              <Plus className="mx-auto h-4 w-4" />
                            </button>
                          </div>

                          <div className="text-xs text-black/55">
                            {businessInfo?.shipping ? "Shipping calculated at checkout" : "No shipping"}
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

        <div className="sticky bottom-0 border-t border-black/10 bg-[var(--surface,#fff)] px-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <div className="text-black/60">Subtotal</div>
            <div className="font-semibold">{currency(subtotal)}</div>
          </div>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={!itemsArray.length || loadingCheckout}
            className={`
              mt-3 h-11 w-full rounded-2xl cursor-pointer font-semibold
              disabled:opacity-60 disabled:cursor-not-allowed
              text-[var(--text-inverse,#fff)]
              bg-[var(--primary,#365b99)]
              hover:opacity-95
              active:scale-[0.99]
              transition
              flex items-center justify-center gap-2
            `}
          >
            {loadingCheckout ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Starting checkout…</span>
              </>
            ) : (
              <span>Proceed to checkout</span>
            )}
          </button>

          <div className="mt-2 text-[11px] text-black/50 text-center">
            You’ll be redirected to a secure Stripe checkout.
          </div>
        </div>
      </section>
    </div>
  );
}