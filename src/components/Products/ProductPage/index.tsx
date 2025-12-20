"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import FloatingCartDialog from "./FloatinCartDialog";
import { Products } from "@/types/Products";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";

type ProductPageClientProps = {
  product: Products | null;
};

export default function ProductPageClient({ product }: ProductPageClientProps) {
  const router = useRouter();

  const siteData = useSiteData();
  const { cartItems, setCartItems } = useCartContext();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surface = siteData?.siteDetails?.surface ?? "var(--surface,#ffffff)";
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png";

  const businessInfo = (siteData as any)?.businessInfo;

  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [addedOpen, setAddedOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<any>(null);

  useMemo(() => {
    if (!product) return;
    const first = product?.usingVariant?.values?.[0];
    if (first && !selectedVariant) setSelectedVariant(first);
  }, [product, selectedVariant]);

  const getSafeFieldValue = (key: string) => {
    if (
      typeof product?.[key] === "object" &&
      selectedVariant &&
      Array.isArray(product?.usingVariant?.values) &&
      product.usingVariant.values.includes(selectedVariant)
    ) {
      return product?.[key]?.[selectedVariant];
    }
    return product?.[key];
  };

  const resolveVariant = () =>
    selectedVariant || product?.usingVariant?.values?.[0] || null;

  const cartCount = useMemo(() => {
    const items = cartItems || {};
    return Object.keys(items).reduce((total, k) => total + (items[k]?.quantity || 0), 0);
  }, [cartItems]);

  const handleAddToCart = () => {
    if (!product) return;

    const variant = resolveVariant();
    const cartKey = `${product.id}_${variant || "default"}`;
    const name = getSafeFieldValue("name");
    const next = { ...(cartItems || {}) };
    const itemAdded = {
      quantity,
      name: variant ? `${name} (${variant})` : name,
      price: getSafeFieldValue("price"),
      priceID:
        typeof product?.default_price === "object" && variant
          ? product.default_price?.[variant]
          : product?.default_price,
      imageUrl: getSafeFieldValue("imageUrl") || siteLogo,
      variant,
    };

    if (next[cartKey]) next[cartKey].quantity += quantity;
    else next[cartKey] = itemAdded;

    setLastAdded(itemAdded);
    setCartItems(next);
    setAddedOpen(true);
  };

  const handleCheckout = async () => {
    if (!product) return;
    setLoadingCheckout(true);

    try {
      const variant = resolveVariant();

      const priceId =
        typeof product?.default_price === "object" && variant
          ? product.default_price?.[variant]
          : product?.default_price;

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          products: [{ price: priceId, quantity }],
          businessName: businessInfo?.name,
          contactEmail: businessInfo?.contactInfo?.email,
          requiresShipping: !!businessInfo?.shipping,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }

      const data = await res.json();

      if (typeof data === "string") {
        window.location.replace(data);
      }
    } catch (err) {
      console.error("[checkout] failed:", err);
    } finally {
      setLoadingCheckout(false);
    }
  };

  if (!product) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="rounded-2xl border bg-white p-6 text-center" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <div className="text-sm font-semibold">Product not found</div>
          <button
            type="button"
            onClick={() => router.push("/products")}
            className="mt-4 h-10 rounded-xl px-4 text-sm font-semibold"
            style={{ background: primary, color: "white" }}
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  const hasNoShipping = businessInfo && businessInfo?.shipping === false;

  const img = getSafeFieldValue("imageUrl") || siteLogo;

  const name = getSafeFieldValue("name");
  const desc = getSafeFieldValue("description");
  const price = getSafeFieldValue("price");

  const variants: string[] = product?.usingVariant?.values || [];

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      {hasNoShipping && (
        <div
          className="mx-4 md:mx-10 lg:mx-20 mt-6 rounded-2xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(0,0,0,0.08)", background: "rgba(255,255,255,0.7)" }}
        >
          <span className="font-semibold">Pickup only:</span>{" "}
          We’re currently not offering shipping.
        </div>
      )}

      <div className="mx-4 md:mx-10 lg:mx-20 pt-8 pb-14">
        <button
          type="button"
          onClick={() => router.push("/products")}
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-black/70 hover:text-black transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to products
        </button>

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div
              className="rounded-3xl border bg-white/70 backdrop-blur shadow-sm overflow-hidden"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="w-full bg-black/5">
                <div
                  className={[
                    "relative w-full overflow-hidden",
                    "h-[280px] sm:h-[360px] md:h-[600px]", 
                  ].join(" ")}
                >
                  <div className="absolute inset-0 p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={name || "Product image"}
                      className="w-full h-full object-contain block"
                      draggable={false}
                      loading="eager"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div
              className="rounded-3xl border bg-white/70 backdrop-blur shadow-sm p-6 md:p-7"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-semibold tracking-tight line-clamp-2">
                    {name}
                  </h1>
                  <p className="mt-2 text-sm md:text-base text-black/60">
                    {desc}
                  </p>
                </div>

                <div className="text-xl md:text-2xl font-semibold shrink-0" style={{ color: primary }}>
                  ${price}
                </div>
              </div>

              {variants.length > 0 && (
                <div className="mt-5">
                  <div className="text-xs font-semibold text-black/60 mb-2">
                    Options
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variants.map((v) => {
                      const active = (selectedVariant || variants[0]) === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className="h-8 px-3 rounded-full text-xs cursor-pointer font-semibold border transition active:scale-[0.98]"
                          style={{
                            background: active ? primary : "transparent",
                            color: active ? "white" : "rgba(0,0,0,0.75)",
                            borderColor: active ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.12)",
                          }}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5">
                <div className="text-xs font-semibold text-black/60 mb-2">
                  Quantity
                </div>
                <div className="inline-flex rounded-xl border bg-white/70 overflow-hidden" style={{ borderColor: "rgba(0,0,0,0.10)" }}>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = quantity === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(n)}
                        className="h-10 w-10 text-sm cursor-pointer font-semibold transition"
                        style={{
                          background: active ? `${primary}22` : "transparent",
                          color: active ? "black" : "rgba(0,0,0,0.65)",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="h-11 rounded-xl cursor-pointer text-sm font-semibold shadow-sm transition active:scale-[0.98]"
                  style={{ background: primary, color: "white" }}
                >
                  Add to cart
                </button>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={loadingCheckout}
                  className="h-11 rounded-xl cursor-pointer text-sm font-semibold border bg-white/70 shadow-sm transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ borderColor: "rgba(0,0,0,0.10)" }}
                >
                  {loadingCheckout ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Starting checkout…
                    </span>
                  ) : (
                    "Buy now"
                  )}
                </button>
              </div>

              <div className="mt-4 text-xs text-black/50">
                Cart items: <span className="font-semibold text-black/70">{cartCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FloatingCartDialog
        open={addedOpen}
        onClose={() => setAddedOpen(false)}
        product={lastAdded}
        quantity={quantity}
        cartCount={cartCount}
        variant={resolveVariant()}
      />
    </div>
  );
}