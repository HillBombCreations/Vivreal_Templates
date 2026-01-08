"use client";

import { useState } from "react";
import { Product } from "@/types/Products";
import { useRouter } from "next/navigation";
import { ShoppingCart, Plus, Minus } from "lucide-react";
import { ProductsTableProps } from "@/types/Products";
import { useCartContext } from "@/contexts/CartContext";
import { getProductKey, getSafeFieldValue } from "@/lib/utils/variantUtils"
import { handleAddToCart } from "@/lib/utils/cartUtils";
import VariantRow from "../VariantRow";
import AddedToCartToast from "../AddToCart";

export default function ProductsTable({
  products,
  selectedVariants,
  setSelectedVariants,
  siteLogo,
  loading = false,
}: ProductsTableProps) {
  const router = useRouter();
  const { cart, setCart } = useCartContext();
  const [addTick, setAddTick] = useState(0);

  const setQty = (productId: string, nextQty: number) => {
    const next = { ...(cart || {}) };

    if (nextQty <= 0) {
      delete next[productId];
    } else if (next[productId]) {
      next[productId] = { ...next[productId], quantity: nextQty };
    }
    setCart(next);
  };

  return (
    <main className="lg:col-span-9">
      {
        !loading ?
        <>
          {!products?.length ? (
            <div className="rounded-2xl border bg-white p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
              <div className="text-sm font-semibold">No products found</div>
              <div className="mt-1 text-sm text-black/60">Try a different filter.</div>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product: Product) => {
                const key = getProductKey(product);
                const selectedVariant = selectedVariants[key] || product.usingVariant?.values?.[0];
                const img = getSafeFieldValue(product, "imageUrl", selectedVariant) || siteLogo;
                const name = getSafeFieldValue(product, "name", selectedVariant);
                const desc = getSafeFieldValue(product, "description", selectedVariant);
                const price = getSafeFieldValue(product, "price", selectedVariant);
                const safeVariant = selectedVariant ?? "default";
                const cartKey = `${product._id}_${safeVariant}`;
                const qtyInCart = cart?.[cartKey]?.quantity || 0;
                const inCart = qtyInCart > 0;

                return (
                  <div
                    key={key}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/products/${encodeURIComponent(String(key))}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/products/${encodeURIComponent(String(key))}`);
                      }
                    }}
                    className={[
                      "group text-left rounded-2xl border bg-white shadow-sm overflow-hidden",
                      "hover:shadow-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10",
                      "flex flex-col h-[420px]",
                    ].join(" ")}
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div
                      className="border-b bg-white"
                      style={{ borderColor: "rgba(0,0,0,0.06)" }}
                    >
                      <div className="h-[190px] w-full relative overflow-hidden bg-white">
                        <div className="absolute inset-0 p-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img}
                            alt={name || "Product image"}
                            className="w-full h-full object-contain block"
                            draggable={false}
                            loading="lazy"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col flex-1 min-h-0">
                      {Array.isArray(product?.usingVariant?.values) && product.usingVariant.values.length > 0 ? (
                        <div className="mb-3">
                          <VariantRow
                            product={product}
                            selectedVariants={selectedVariants}
                            setSelectedVariants={setSelectedVariants}
                          />
                        </div>
                      ) : (
                        <div className="h-8 mb-3" />
                      )}

                      <div className="font-semibold leading-snug line-clamp-2">
                        {name}
                      </div>
                      <div className="mt-1 text-sm text-black/60 line-clamp-2">
                        {desc}
                      </div>
                      <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                        <div className="text-base font-semibold" style={{ color: "var(--primary)" }}>
                          ${price}
                        </div>

                        {inCart ? (
                        <div
                          className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1"
                          style={{ background: 'var(--primary)', color: "var(--text-inverse)"}}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="h-7 w-7 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
                            onClick={() => setQty(cartKey, qtyInCart - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="mx-auto h-4 w-4" />
                          </button>

                          <div className="w-8 text-center text-sm font-semibold">{qtyInCart}</div>

                          <button
                            type="button"
                            className="h-7 w-7 cursor-pointer rounded-full hover:bg-black/5 disabled:opacity-40"
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
                            handleAddToCart({
                              product,
                              selectedVariant,
                              quantity: 1,
                              cart,
                              setCart,
                              setAddedOpen: () => setAddTick((n) => n + 1),
                            });
                          }}
                          className={[
                            "h-10 px-3 cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center gap-2",
                            "shadow-sm transition active:scale-[0.98]",
                            "group-hover:shadow",
                          ].join(" ")}
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
              })}
            </div>
          )}
        </>
        :
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={[
                "group text-left rounded-2xl border bg-white shadow-sm overflow-hidden",
                "hover:shadow-md transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-black/10",
                "flex flex-col h-[420px]",
              ].join(" ")}
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div
                className="border-b bg-white"
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
              >
                <div className="h-[190px] w-full bg-gray-200" />
              </div>

              <div className="p-4 flex flex-col flex-1 min-h-0">
                <div className="h-8 mb-3 rounded bg-gray-200" />

                <div className="space-y-2">
                  <div className="h-5 w-[85%] rounded bg-gray-200" />
                  <div className="h-5 w-[65%] rounded bg-gray-200" />
                </div>

                <div className="mt-3 space-y-2">
                  <div className="h-4 w-full rounded bg-gray-200" />
                  <div className="h-4 w-[85%] rounded bg-gray-200" />
                </div>

                <div className="mt-auto pt-3 flex items-center justify-between gap-3">
                  <div className="h-6 w-16 rounded bg-gray-200" />
                  <div className="h-10 w-24 rounded-xl bg-gray-200" />
                </div>
              </div>
            </div>
          ))}
        </div>
      }
      

      <AddedToCartToast addTick={addTick} />
    </main>
  );
}