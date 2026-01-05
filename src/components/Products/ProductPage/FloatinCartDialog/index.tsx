"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, X, Loader2 } from "lucide-react";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import { FloatingCartDialogProps } from "@/types/Products";
import { getSafeFieldValue } from "@/lib/variantUtils";
import { CartItem } from "@/types/Cart";

export default function FloatingCartDialog({
  open,
  onClose,
  product,
  quantity,
  cartCount,
  variant,
  originUrl,
}: FloatingCartDialogProps) {
  const siteData = useSiteData();
  const { cart, setOpenCartMenu } = useCartContext();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png";

  const businessInfo = siteData?.businessInfo;

  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [disableButtons, setDisableButtons] = useState(false);

  const safeName = useMemo(() => {
    return getSafeFieldValue(product, "name", variant) || "";
  }, [product, variant]);

  const safePrice = useMemo(() => {
    const raw = getSafeFieldValue(product, "price", variant);
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [product, variant]);

  const safeImg = useMemo(() => {
    if (!product) return siteLogo;

    return getSafeFieldValue(product, "imageUrl", variant) || siteLogo;

  }, [product, variant, siteLogo]);

  const handleOpenCart = () => {
    onClose();
    setOpenCartMenu?.(true);
  };

  const handleCheckout = async () => {
    setLoadingCheckout(true);
    setDisableButtons(true);

    try {
      const items = Object.values(cart || {}).map((item: CartItem) => ({
        price:
          typeof item.priceID === "object" && item.variant ? item.priceID[item.variant] : item.priceID,
        quantity: item.quantity,
      }));

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          products: items,
          businessName: businessInfo?.name,
          contactEmail: businessInfo?.contactInfo?.email,
          requiresShipping: !!businessInfo?.shipping,
          originUrl: originUrl
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await res.json();

      if (data && !(data?.status && data.status === 400)) {
        setOpenCartMenu(false);
        window.location.replace(data);
      }

      console.error("Error creating checkout session:", data);
      setLoadingCheckout(false);
      setDisableButtons(false);
    } catch (error) {
      console.error("Checkout error:", error);
      setLoadingCheckout(false);
      setDisableButtons(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (loadingCheckout) return;

    const t = setTimeout(() => onClose(), 10000);
    return () => clearTimeout(t);
  }, [open, onClose, loadingCheckout]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none">
      <div className="hidden md:block pointer-events-auto absolute top-4 right-4 w-[360px]">
        <div
          className="rounded-2xl border bg-white/90 backdrop-blur shadow-lg overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.10)" }}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} />
                <div className="text-sm font-semibold">Added to bag</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={loadingCheckout}
                className="h-8 w-8 cursor-pointer rounded-full grid place-items-center hover:bg-black/5 transition disabled:opacity-60"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {product ? (
              <div className="mt-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={safeImg}
                  alt={safeName || "Product"}
                  className="h-14 w-14 rounded-xl object-cover bg-black/5"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold line-clamp-1">{safeName}</div>
                  <div className="mt-0.5 text-xs text-black/60">
                    {quantity} × ${safePrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleOpenCart}
                disabled={disableButtons}
                className="h-10 rounded-xl cursor-pointer border bg-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
                style={{ borderColor: "rgba(0,0,0,0.10)" }}
              >
                View bag ({cartCount})
              </button>

              <button
                type="button"
                onClick={handleCheckout}
                disabled={disableButtons}
                className="h-10 rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
                style={{ background: primary, color: "white" }}
              >
                {loadingCheckout ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checkout…
                  </>
                ) : (
                  "Checkout"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="md:hidden pointer-events-auto absolute inset-x-0 bottom-0">
        <div className="bg-black/40 h-[100dvh] w-full pointer-events-auto" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" style={{ color: "#22c55e" }} />
              <div className="text-sm font-semibold">Added to bag</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loadingCheckout}
              className="h-9 w-9 rounded-full grid place-items-center hover:bg-black/5 transition disabled:opacity-60"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {product ? (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeImg}
                alt={safeName || "Product"}
                className="h-14 w-14 rounded-xl object-cover bg-black/5"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold line-clamp-1">{safeName}</div>
                <div className="mt-0.5 text-xs text-black/60">
                  {quantity} × ${safePrice.toFixed(2)}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleOpenCart}
              disabled={disableButtons}
              className="h-11 rounded-xl cursor-pointer border bg-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              View bag ({cartCount})
            </button>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={disableButtons}
              className="h-11 rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
              style={{ background: primary, color: "white" }}
            >
              {loadingCheckout ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checkout…
                </>
              ) : (
                "Checkout"
              )}
            </button>
          </div>

          <div className="mt-2 text-[11px] text-black/50">
            You can edit items in your bag before checkout.
          </div>
        </div>
      </div>
    </div>
  );
}