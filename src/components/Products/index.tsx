"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, X } from "lucide-react";
import { Products } from "@/types/Products";
import AddedToCartToast from "./AddToCart";
import VariantRow from "./VariantRow";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";

type Props = {
  products: Products[];
  initialFilter: string;
  filters: string[];
  initialSelectedVariants: Record<string, string>;
};

export default function ProductsPageClient({
  products,
  initialFilter,
  filters,
  initialSelectedVariants,
}: Props) {
  const router = useRouter();
  const siteData = useSiteData();
  const { cartItems, setCartItems } = useCartContext();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surface = siteData?.siteDetails?.surface ?? "var(--surface,#ffffff)";
  const siteLogo = siteData?.siteDetails?.logo?.imageUrl || "/heroImage.png";

  const businessInfo = (siteData as any)?.businessInfo;
  const hasNoShipping = businessInfo && businessInfo?.shipping === false;

  const [filterType, setFilterType] = useState<string>(initialFilter || "");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(
    initialSelectedVariants || {}
  );
  const [itemAdded, setItemAdded] = useState(false);

  useEffect(() => {
    setFilterType(initialFilter || "");
  }, [initialFilter]);

  useEffect(() => {
    setSelectedVariants((prev) => ({ ...(initialSelectedVariants || {}), ...prev }));
  }, [initialSelectedVariants]);

  const resolveField = (field: string, product: any, selectedVariant?: string) => {
    const v = selectedVariant;
    if (typeof product?.[field] === "object" && v && product?.[field]?.[v]) {
      return product[field][v];
    }
    return product?.[field];
  };

  const getProductKey = (p: any) => p?._id;

  const getSafeFieldValue = (obj: any, field: string) => {
    const key = getProductKey(obj);
    const selected = selectedVariants?.[key];

    if (!obj?.usingVariant?.name || !selected) return obj?.[field];

    if (
      typeof obj?.[field] === "object" &&
      obj?.[field] !== null &&
      Array.isArray(obj?.usingVariant?.values) &&
      obj.usingVariant.values.some((val: string) =>
        Object.keys(obj?.[field] || {}).includes(val)
      )
    ) {
      return obj[field][selected];
    }

    return obj?.[field];
  };

  const handleAddToCart = (product: any) => {
    const key = getProductKey(product);
    const selectedVariant = selectedVariants[key] || product.usingVariant?.values?.[0];

    const cartKey = `${key}_${selectedVariant || "default"}`;
    const next = { ...(cartItems || {}) };
    const itemAdded = {
      quantity: 1,
      name: selectedVariant
        ? `${resolveField("name", product, selectedVariant)} (${selectedVariant})`
        : resolveField("name", product),
      price: resolveField("price", product, selectedVariant),
      priceID: resolveField("default_price", product, selectedVariant),
      imageUrl: resolveField("imageUrl", product, selectedVariant) || siteLogo,
      variant: selectedVariant,
    };
    console.log('ITEM ADDED', itemAdded);
    if (next[cartKey]) {
      next[cartKey].quantity += 1;
    } else {
      next[cartKey] = itemAdded;
    }

    setCartItems(next);
    setItemAdded(true);
  };

  const applyFilter = (value: string) => {
    setFilterType(value);
    const url = value ? `/products?filter=${encodeURIComponent(value)}` : "/products";
    router.replace(url);
  };

  const clearFilter = () => applyFilter("");

  return (
    <div className="min-h-[100dvh]" style={{ background: surface }}>
      {hasNoShipping && (
        <div
          className="mx-4 md:mx-10 lg:mx-20 mt-6 rounded-2xl border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.7)",
          }}
        >
          <span className="font-semibold">Pickup only:</span> We’re currently not offering shipping.
        </div>
      )}

      <div className="mx-4 md:mx-10 lg:mx-20 mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Products</h1>
            <p className="mt-1 text-sm text-black/60">
              Browse our collection and add your favorites to the cart.
            </p>
          </div>

          {filterType ? (
            <button
              type="button"
              onClick={clearFilter}
              className="inline-flex items-center gap-2 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-white transition"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <X className="h-4 w-4" />
              Clear filter
            </button>
          ) : null}
        </div>
      </div>

      <div className="mx-4 md:mx-10 lg:mx-20 mt-8 pb-16">
        <div className="grid gap-6 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div
              className="rounded-2xl border bg-white/70 backdrop-blur p-4"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Types</div>
              </div>

              {filters?.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => applyFilter("")}
                    className={[
                      "text-left rounded-xl border px-3 py-2 text-sm font-semibold transition",
                      !filterType ? "bg-white shadow-sm" : "bg-white/40 hover:bg-white",
                    ].join(" ")}
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    All
                  </button>

                  {filters.map((t) => {
                    const active = t === filterType;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => applyFilter(t)}
                        className={[
                          "text-left rounded-xl border px-3 py-2 text-sm font-semibold transition",
                          active ? "bg-white shadow-sm" : "bg-white/40 hover:bg-white",
                        ].join(" ")}
                        style={{
                          borderColor: "rgba(0,0,0,0.08)",
                          color: active ? "black" : "rgba(0,0,0,0.75)",
                        }}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 text-sm text-black/50">No filters</div>
              )}
            </div>
          </aside>

          <main className="lg:col-span-9">
            {!products?.length ? (
              <div className="rounded-2xl border bg-white p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="text-sm font-semibold">No products found</div>
                <div className="mt-1 text-sm text-black/60">Try a different filter.</div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product: any) => {
                  const key = getProductKey(product);

                  const img = getSafeFieldValue(product, "imageUrl") || siteLogo;
                  const name = getSafeFieldValue(product, "name");
                  const desc = getSafeFieldValue(product, "description");
                  const price = getSafeFieldValue(product, "price");

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
                          <div className="text-base font-semibold" style={{ color: primary }}>
                            ${price}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(product);
                            }}
                            className={[
                              "h-10 px-3 cursor-pointer rounded-xl text-sm font-semibold inline-flex items-center gap-2",
                              "shadow-sm transition active:scale-[0.98]",
                              "group-hover:shadow",
                            ].join(" ")}
                            style={{ background: primary, color: "white" }}
                          >
                            <ShoppingCart className="h-4 w-4" />
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <AddedToCartToast itemAdded={itemAdded} setItemAdded={setItemAdded} />
          </main>
        </div>
      </div>
    </div>
  );
}