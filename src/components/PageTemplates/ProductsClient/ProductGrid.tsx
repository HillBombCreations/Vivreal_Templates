"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import type { Product } from "@/types/Products";
import { useCartContext } from "@/contexts/CartContext";
import { getProductKey, getSafeFieldValue } from "@/lib/utils/variantUtils";
import { handleAddToCart } from "@/lib/utils/cartUtils";
import { useSiteData } from "@/contexts/SiteDataContext";

interface ProductGridProps {
  products: Product[];
  selectedVariants: Record<string, string>;
  setSelectedVariants: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  slug: string;
  loading?: boolean;
  onItemAdded?: () => void;
}

export default function ProductGrid({
  products,
  selectedVariants,
  setSelectedVariants,
  slug,
  loading = false,
  onItemAdded,
}: ProductGridProps) {
  const router = useRouter();
  const siteData = useSiteData();
  const { cart, setCart } = useCartContext();
  const siteLogo = siteData?.logo?.currentFile?.source || "/logo.png";

  const setQty = (cartKey: string, nextQty: number) => {
    const next = { ...(cart || {}) };
    if (nextQty <= 0) {
      delete next[cartKey];
    } else if (next[cartKey]) {
      next[cartKey] = { ...next[cartKey], quantity: nextQty };
    }
    setCart(next);
  };

  if (loading) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden flex flex-col h-[420px] animate-pulse"
          >
            <div className="border-b border-black/[0.04]">
              <div className="h-[190px] w-full bg-black/[0.04]" />
            </div>
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <div className="h-7 mb-3 rounded-lg bg-black/[0.04] w-20" />
              <div className="space-y-2">
                <div className="h-5 w-[85%] rounded-lg bg-black/[0.04]" />
                <div className="h-5 w-[60%] rounded-lg bg-black/[0.04]" />
              </div>
              <div className="mt-3 space-y-2">
                <div className="h-4 w-full rounded-lg bg-black/[0.03]" />
                <div className="h-4 w-[80%] rounded-lg bg-black/[0.03]" />
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between gap-3">
                <div className="h-6 w-16 rounded-lg bg-black/[0.04]" />
                <div className="h-10 w-20 rounded-full bg-black/[0.04]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
        <div className="text-base font-semibold">No products found</div>
        <div className="mt-1 text-sm text-black/50">
          Try a different filter or search term.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard
          key={getProductKey(product)}
          product={product}
          selectedVariants={selectedVariants}
          setSelectedVariants={setSelectedVariants}
          siteLogo={siteLogo}
          cart={cart}
          setQty={setQty}
          onAddToCart={() => {
            handleAddToCart({
              product,
              selectedVariant:
                selectedVariants[getProductKey(product)] ||
                product.usingVariant?.values?.[0] ||
                null,
              quantity: 1,
              cart,
              setCart,
            });
            onItemAdded?.();
          }}
          onClick={() =>
            router.push(
              `/${slug}/${encodeURIComponent(getProductKey(product))}`
            )
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Individual product card                                           */
/* ------------------------------------------------------------------ */

interface ProductCardProps {
  product: Product;
  selectedVariants: Record<string, string>;
  setSelectedVariants: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  siteLogo: string;
  cart: Record<string, { quantity: number }>;
  setQty: (cartKey: string, qty: number) => void;
  onAddToCart: () => void;
  onClick: () => void;
}

function ProductCard({
  product,
  selectedVariants,
  setSelectedVariants,
  siteLogo,
  cart,
  setQty,
  onAddToCart,
  onClick,
}: ProductCardProps) {
  const key = getProductKey(product);
  const selectedVariant =
    selectedVariants[key] || product.usingVariant?.values?.[0] || null;
  const img =
    getSafeFieldValue(product, "imageUrl", selectedVariant) || siteLogo;
  const name = getSafeFieldValue(product, "name", selectedVariant);
  const desc = getSafeFieldValue(product, "description", selectedVariant);
  const price = getSafeFieldValue(product, "price", selectedVariant);
  const safeVariant = selectedVariant ?? "default";
  const cartKey = `${product._id}_${safeVariant}`;
  const qtyInCart = cart?.[cartKey]?.quantity || 0;
  const inCart = qtyInCart > 0;

  const variants = product.usingVariant?.values || [];

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group text-left rounded-2xl border border-black/[0.06] bg-white overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10 flex flex-col h-[420px]"
    >
      {/* Image */}
      <div className="border-b border-black/[0.04] bg-black/[0.01]">
        <div className="h-[190px] w-full relative overflow-hidden">
          <div className="absolute inset-0 p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img}
              alt={name || "Product image"}
              className="w-full h-full object-contain block transition-transform duration-300 group-hover:scale-105"
              draggable={false}
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 flex flex-col flex-1 min-h-0">
        {/* Variant pills */}
        {variants.length > 0 ? (
          <div className="mb-3 flex flex-nowrap gap-x-1.5 overflow-hidden pb-1">
            {variants.slice(0, 4).map((v) => {
              const isSelected = selectedVariants[key] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedVariants((prev) => ({ ...prev, [key]: v }));
                  }}
                  className="h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border transition active:scale-[0.98] max-w-[140px] truncate cursor-pointer"
                  style={{
                    background: isSelected ? "var(--primary)" : "transparent",
                    color: isSelected ? "white" : "var(--primary)",
                    borderColor: isSelected
                      ? "rgba(0,0,0,0.10)"
                      : "var(--primary)",
                  }}
                  aria-pressed={isSelected}
                >
                  {v}
                </button>
              );
            })}
            {variants.length > 4 && (
              <div
                className="h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border flex items-center"
                style={{
                  color: "var(--primary)",
                  borderColor: "var(--primary)",
                  opacity: 0.9,
                }}
              >
                +{variants.length - 4}
              </div>
            )}
          </div>
        ) : (
          <div className="h-8 mb-3" />
        )}

        <div className="font-semibold leading-snug line-clamp-2 text-[15px]">
          {name}
        </div>
        <div className="mt-1.5 text-sm text-black/50 line-clamp-2 leading-relaxed">
          {desc}
        </div>

        {/* Price + cart controls */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-3">
          <div
            className="text-lg font-bold"
            style={{ color: "var(--primary)" }}
          >
            ${price}
          </div>

          {inCart ? (
            <div
              className="inline-flex items-center gap-1 rounded-full px-2 py-1"
              style={{
                background: "var(--primary)",
                color: "var(--text-inverse, white)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="h-7 w-7 cursor-pointer rounded-full hover:bg-white/10 transition"
                onClick={() => setQty(cartKey, qtyInCart - 1)}
                aria-label="Decrease quantity"
              >
                <Minus className="mx-auto h-4 w-4" />
              </button>
              <div className="w-7 text-center text-sm font-bold">
                {qtyInCart}
              </div>
              <button
                type="button"
                className="h-7 w-7 cursor-pointer rounded-full hover:bg-white/10 transition"
                onClick={() => setQty(cartKey, qtyInCart + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="mx-auto h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart();
              }}
              className="h-10 px-4 cursor-pointer rounded-full text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
              style={{ background: "var(--primary)", color: "white" }}
            >
              <ShoppingCart className="h-4 w-4" />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
