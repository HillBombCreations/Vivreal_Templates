"use client";

import { useEffect, useMemo, useState } from "react";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import { X, Plus, Minus, Trash2, ShoppingBag, Check, Loader2, Tag } from "lucide-react";
import { BrandMark } from "@hillbombcreations/site-renderer";
import type { CartDialogProps, CartItem } from "@/types/Cart";
import {
  handleCheckout,
  validateCoupon,
  type CouponPreview,
  type CartLineItemInput,
} from "@/lib/utils/cartUtils";

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n || 0);

/**
 * Map a VR_Client_API validation `reason` to the §5.5 customer-facing copy.
 * Unknown reasons fall through to the generic "isn't valid" line.
 */
function couponErrorCopy(reason: string | undefined): string {
  switch (reason) {
    case "expired":
      return "This code has expired.";
    case "min_subtotal":
      return "Your cart doesn't meet this code's minimum.";
    case "scope_miss":
      return "This code doesn't apply to items in your cart.";
    case "limit_reached":
      return "This code has reached its limit.";
    case "inactive":
    case "not_found":
    default:
      return "That code isn't valid.";
  }
}

export default function CartDialog({ open, onClose }: CartDialogProps) {
  const { cart, setCart, setOpenCartMenu } = useCartContext();
  const siteData = useSiteData();

  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";
  const businessInfo = siteData?.businessInfo || null;

  const [loadingCheckout, setLoadingCheckout] = useState(false);

  // Promo-code state — the cart owns the applied-code lifecycle (this component
  // stays mounted across open/close, so it persists for the session). Discount
  // here is a DISPLAY value; Stripe re-validates + applies the authoritative
  // amount at checkout (plan §1.3/§5.5).
  const [codeInput, setCodeInput] = useState("");
  const [applyingCode, setApplyingCode] = useState(false);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [codeError, setCodeError] = useState<string | null>(null);

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

  // Stripe-price-id line items for coupon validation (matches the checkout
  // payload shape — the server keys scope/amount off the price id).
  const cartLineItems = useMemo<CartLineItemInput[]>(
    () =>
      itemsArray
        .filter((item) => item.priceID)
        .map((item) => ({ price: item.priceID, quantity: item.quantity || 1 })),
    [itemsArray]
  );

  const hasDiscount = appliedCode != null && discount > 0;
  const total = Math.max(0, subtotal - (hasDiscount ? discount : 0));

  // A coupon's discount depends on the exact cart. Any cart change invalidates a
  // previously-applied code — clear it rather than show a stale discount (R2).
  useEffect(() => {
    if (appliedCode) {
      setAppliedCode(null);
      setDiscount(0);
      setCodeError(null);
    }
    // Intentionally keyed on the cart line items only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLineItems]);

  const setQty = (productId: string, nextQty: number) => {
    const next = { ...(cart || {}) };
    if (nextQty <= 0) {
      delete next[productId];
    } else if (next[productId]) {
      next[productId] = { ...next[productId], quantity: nextQty };
    }
    setCart(next);
  };

  const onApplyCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code || applyingCode || cartLineItems.length === 0) return;
    setApplyingCode(true);
    setCodeError(null);
    try {
      const result: CouponPreview = await validateCoupon(code, cartLineItems);
      if (result.valid) {
        // VR_Client_API returns `newSubtotal` in CENTS (it prices off Stripe
        // unit_amount). Our cart `subtotal` is in DOLLARS (display price string),
        // so convert the server value before differencing. The displayed
        // discount is a PREVIEW; Stripe applies the authoritative amount at
        // checkout. Clamp to [0, subtotal] so a stale/odd value never shows a
        // negative or larger-than-cart discount.
        const newSubtotalDollars =
          typeof result.newSubtotal === "number" ? result.newSubtotal / 100 : subtotal;
        const previewDiscount = Math.min(subtotal, Math.max(0, subtotal - newSubtotalDollars));
        setAppliedCode(code);
        setDiscount(previewDiscount);
        setCodeInput("");
        setCodeError(null);
      } else {
        setAppliedCode(null);
        setDiscount(0);
        setCodeError(couponErrorCopy(result.reason));
      }
    } catch {
      setAppliedCode(null);
      setDiscount(0);
      setCodeError(couponErrorCopy(undefined));
    } finally {
      setApplyingCode(false);
    }
  };

  const onRemoveCode = () => {
    setAppliedCode(null);
    setDiscount(0);
    setCodeError(null);
    setCodeInput("");
  };

  const onCheckout = async () => {
    setLoadingCheckout(true);
    try {
      await handleCheckout({
        cart,
        requiresShipping: !!businessInfo?.shipping,
        originUrl: window.location.origin,
        ...(appliedCode ? { code: appliedCode } : {}),
      });
      setOpenCartMenu(false);
    } catch (err) {
      // Re-validation failed at checkout (e.g. code limit hit between apply and
      // checkout). Clear the code + surface the error — never proceed silently
      // and never silently charge full (plan §5.5 / R2).
      if (appliedCode) {
        setAppliedCode(null);
        setDiscount(0);
      }
      setCodeError(
        err instanceof Error && err.message
          ? err.message
          : "Checkout could not be started. Please try again."
      );
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
              {/* BrandMark: aspect-aware — a wide wordmark logo falls back to
                  the site's FAVICON tile (else a letter-mark) instead of a
                  center-cropped letter slice. */}
              <BrandMark src={siteLogo} name={siteData?.name} fallbackSrc={siteData?.favicon} shape="avatar" size={40} radius={14} />
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
                          // Logo fallback must NEVER be cropped (wordmark logos
                          // die in object-cover) — contain it on white instead.
                          className={item?.imageUrl ? "h-full w-full object-cover" : "h-full w-full object-contain bg-white p-1.5"}
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
          {/* Promo code (plan §5.5). Display only — Stripe re-validates + applies
              the authoritative discount at checkout. */}
          {itemsArray.length > 0 ? (
            <div className="mb-3">
              {appliedCode ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0 text-sm font-semibold">
                    <Check className="h-4 w-4 shrink-0" style={{ color: "var(--primary,#365b99)" }} aria-hidden="true" />
                    <span className="truncate">{appliedCode} applied</span>
                  </div>
                  <button
                    type="button"
                    onClick={onRemoveCode}
                    disabled={loadingCheckout}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-white hover:bg-black/5 disabled:opacity-50"
                    aria-label="Remove promo code"
                  >
                    <X className="mx-auto h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-black/55">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    Promo code
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void onApplyCode();
                        }
                      }}
                      disabled={applyingCode || loadingCheckout}
                      placeholder="Enter code"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={!!codeError}
                      className="h-10 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm uppercase tracking-wide outline-none focus:border-black/25 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => void onApplyCode()}
                      disabled={applyingCode || loadingCheckout || !codeInput.trim()}
                      className="h-10 px-4 cursor-pointer rounded-xl border border-black/10 bg-white text-sm font-semibold hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 min-w-[84px]"
                    >
                      {applyingCode ? (
                        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                      ) : (
                        "Apply"
                      )}
                    </button>
                  </div>
                  {codeError ? (
                    <div className="mt-1.5 text-xs font-medium" style={{ color: "#b91c1c" }} role="alert">
                      {codeError}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className="flex items-center justify-between text-sm">
            <div className="text-black/60">Subtotal</div>
            <div className="font-semibold">{currency(subtotal)}</div>
          </div>

          {hasDiscount ? (
            <>
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-black/60">Discount{appliedCode ? ` (${appliedCode})` : ""}</div>
                <div className="font-semibold" style={{ color: "var(--primary,#365b99)" }}>
                  −{currency(discount)}
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <div className="text-black/70 font-semibold">Total</div>
                <div className="font-bold">{currency(total)}</div>
              </div>
            </>
          ) : null}

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
