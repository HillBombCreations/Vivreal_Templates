"use client";

import { useMemo } from "react";
import type { CartAdapter, DetailProductData } from "@hillbombcreations/site-renderer";
import type { Product } from "@/types/Products";
import { useCartContext } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import { handleAddToCart, handleCheckout } from "@/lib/utils/cartUtils";
import { resolveVariant, resolveVariantableString, getSafeFieldValue } from "@/lib/utils/variantUtils";

/**
 * Maps the renderer's `DetailProductData` back to the Templates `Product`
 * shape. The two share field names, so this is a structural narrowing — the
 * only divergence is that the renderer marks several fields optional that the
 * Templates `Product` requires, so we coalesce to sensible empties.
 */
function rendererProductToTemplates(product: DetailProductData): Product {
  return {
    _id: product._id,
    name: product.name ?? "",
    price: product.price ?? "",
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    link: product.link,
    productType: product.productType,
    buttonLabel: product.buttonLabel,
    usingVariant: product.usingVariant,
    default_price: product.default_price,
    quantityOptions: product.quantityOptions,
    quantityUnit: product.quantityUnit,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
  };
}

/**
 * Builds a `CartAdapter` (the renderer's injected cart contract) backed by the
 * Templates `CartContext` + the existing `handleAddToCart` / `handleCheckout`
 * helpers. Bridges renderer client components (ProductsPage, DetailPageTemplate)
 * to the real cart so the live storefront behaves identically to the legacy
 * ProductsClient / ProductDetailClient.
 *
 * Must be called inside a `CartProvider` (it reads `useCartContext`).
 */
export function useCartAdapter(): CartAdapter {
  const { cart, setCart } = useCartContext();
  const siteData = useSiteData();

  return useMemo<CartAdapter>(() => ({
    addToCart: ({ product, variant, quantity }) => {
      handleAddToCart({
        product: rendererProductToTemplates(product),
        selectedVariant: variant,
        quantity,
        cart,
        setCart,
      });
    },

    buyNow: async ({ product, variant, quantity }) => {
      // Mirrors ProductDetailClient.onBuyNow: build a single-item cart and
      // hand it straight to handleCheckout (Stripe redirect).
      const templatesProduct = rendererProductToTemplates(product);
      const resolvedVariant = resolveVariant(variant, templatesProduct) ?? "default";
      const priceID = resolveVariantableString(templatesProduct.default_price, variant) ?? "";
      const name = getSafeFieldValue(templatesProduct, "name", variant) ?? "";
      const price = getSafeFieldValue(templatesProduct, "price", variant) ?? "";
      const imageUrl = getSafeFieldValue(templatesProduct, "imageUrl", variant) ?? "";

      await handleCheckout({
        cart: {
          [`${templatesProduct._id}_${resolvedVariant}`]: {
            _id: templatesProduct._id,
            quantity,
            name,
            price,
            priceID,
            imageUrl,
            variant: resolvedVariant,
          },
        },
        requiresShipping: siteData?.businessInfo?.shipping !== false,
        originUrl: typeof window !== "undefined" ? window.location.origin : "",
      });
    },

    getCartCount: () =>
      Object.values(cart || {}).reduce((total, item) => total + (item?.quantity || 0), 0),
  }), [cart, setCart, siteData]);
}
