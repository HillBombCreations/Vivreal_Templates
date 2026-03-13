"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShoppingCart } from "lucide-react";
import type { Product } from "@/types/Products";
import type { SiteData } from "@/types/SiteData";
import { getSafeFieldValue, resolveVariant } from "@/lib/utils/variantUtils";
import { handleAddToCart, handleCheckout } from "@/lib/utils/cartUtils";
import { useCartContext } from "@/contexts/CartContext";

interface ProductDetailClientProps {
  product: Product;
  siteData: SiteData;
}

export default function ProductDetailClient({
  product,
  siteData,
}: ProductDetailClientProps) {
  const router = useRouter();
  const { cart, setCart } = useCartContext();

  const primary = siteData?.primary ?? "var(--primary,#1a1a2e)";
  const surface = siteData?.surface ?? "var(--surface,#ffffff)";
  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  useMemo(() => {
    if (!product) return;
    const first = product?.usingVariant?.values?.[0];
    if (first && !selectedVariant) setSelectedVariant(first);
  }, [product, selectedVariant]);

  const cartCount = useMemo(() => {
    const items = cart || {};
    return Object.keys(items).reduce(
      (total, k) => total + (items[k]?.quantity || 0),
      0
    );
  }, [cart]);

  if (!product) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center max-w-sm">
          <div className="text-lg font-semibold">Product not found</div>
          <p className="mt-2 text-sm text-black/50">
            This product may have been removed or is no longer available.
          </p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-6 h-11 px-6 rounded-full text-sm font-semibold cursor-pointer transition active:scale-[0.98]"
            style={{ background: primary, color: "white" }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const img =
    getSafeFieldValue(product, "imageUrl", selectedVariant) || siteLogo;
  const name = getSafeFieldValue(product, "name", selectedVariant);
  const desc = getSafeFieldValue(product, "description", selectedVariant);
  const price = getSafeFieldValue(product, "price", selectedVariant);

  const variants: string[] = product?.usingVariant?.values || [];

  const onAddToCart = () => {
    handleAddToCart({
      product,
      selectedVariant,
      quantity,
      cart,
      setCart,
    });
  };

  const onBuyNow = async () => {
    setLoadingCheckout(true);
    try {
      await handleCheckout({
        cart: {
          [`${product._id}_${resolveVariant(selectedVariant, product) ?? "default"}`]:
            {
              _id: product._id,
              quantity,
              name: name ?? "",
              price: price ?? "",
              priceID: product.default_price
                ? typeof product.default_price === "string"
                  ? product.default_price
                  : ""
                : "",
              imageUrl: img ?? "",
              variant: resolveVariant(selectedVariant, product) ?? "default",
            },
        },
        requiresShipping: siteData?.businessInfo?.shipping !== false,
        originUrl: window.location.origin,
      });
    } catch {
      // checkout redirect failed
    } finally {
      setLoadingCheckout(false);
    }
  };

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12 pt-24 md:pt-28 pb-16">
        {/* Back button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-black/60 hover:text-black transition mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </button>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Product image */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
              <div className="relative bg-black/[0.01]">
                <div className="w-full h-[320px] sm:h-[400px] md:h-[520px] lg:h-[600px] flex items-center justify-center p-8 lg:p-12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={name || "Product image"}
                    className="w-full h-full object-contain"
                    draggable={false}
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Product details */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <div className="rounded-2xl border border-black/[0.06] bg-white p-6 md:p-8">
                {/* Name + price */}
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-tight">
                    {name}
                  </h1>
                  <div
                    className="mt-3 text-2xl md:text-3xl font-bold"
                    style={{ color: primary }}
                  >
                    ${price}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-4 text-sm md:text-[15px] text-black/55 leading-relaxed">
                  {desc}
                </p>

                {/* Variant selector */}
                {variants.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-semibold text-black/50 uppercase tracking-wider mb-3">
                      Options
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v) => {
                        const active =
                          (selectedVariant || variants[0]) === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className="h-9 px-4 rounded-full text-xs cursor-pointer font-semibold border transition-all active:scale-[0.97]"
                            style={{
                              background: active ? primary : "transparent",
                              color: active ? "white" : "rgba(0,0,0,0.65)",
                              borderColor: active
                                ? "transparent"
                                : "rgba(0,0,0,0.1)",
                            }}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quantity selector */}
                <div className="mt-6">
                  <div className="text-xs font-semibold text-black/50 uppercase tracking-wider mb-3">
                    Quantity
                  </div>
                  <div className="inline-flex rounded-full border border-black/[0.08] bg-black/[0.01] overflow-hidden">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const active = quantity === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setQuantity(n)}
                          className="h-10 w-10 text-sm cursor-pointer font-semibold transition-all"
                          style={{
                            background: active
                              ? `${primary}15`
                              : "transparent",
                            color: active ? primary : "rgba(0,0,0,0.5)",
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    onClick={onAddToCart}
                    className="h-12 rounded-full cursor-pointer text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] inline-flex items-center justify-center gap-2"
                    style={{ background: primary, color: "white" }}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to cart
                  </button>

                  <button
                    type="button"
                    onClick={onBuyNow}
                    disabled={loadingCheckout}
                    className="h-12 rounded-full cursor-pointer text-sm font-semibold border border-black/[0.08] bg-white hover:bg-black/[0.02] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingCheckout ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Starting checkout...
                      </span>
                    ) : (
                      "Buy now"
                    )}
                  </button>
                </div>

                {/* Cart count */}
                <div className="mt-4 text-xs text-black/40 text-center">
                  {cartCount > 0 ? (
                    <>
                      {cartCount} item{cartCount !== 1 ? "s" : ""} in cart
                    </>
                  ) : (
                    "Your cart is empty"
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
