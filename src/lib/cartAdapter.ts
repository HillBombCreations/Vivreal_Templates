"use client";

import { useMemo } from "react";
import type { CartAdapter } from "@hillbombcreations/site-renderer";
import { useOptionalCart } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import {
  handleAddToCart,
  handleCheckout,
  BUY_NOW_FAILED_MESSAGE,
  UNBUYABLE_ITEM_MESSAGE,
} from "@/lib/utils/cartUtils";
import { resolveVariant, resolveVariantableString, getSafeFieldValue } from "@/lib/utils/variantUtils";
import { rendererProductToTemplates } from "@/lib/cartProduct";
import { toast } from "@/hooks/use-toast";
import { shipsOrders } from "@/lib/shipping";

/** How long a refusal stays up. Longer than a confirmation: it has to be read. */
const FAILURE_TOAST_MS = 8000;

/**
 * Builds a `CartAdapter` (the renderer's injected cart contract) backed by the
 * Templates `CartContext` + the existing `handleAddToCart` / `handleCheckout`
 * helpers. Bridges renderer client components (ProductsPage, DetailPageTemplate)
 * to the real cart so the live storefront behaves identically to the legacy
 * ProductsClient / ProductDetailClient.
 *
 * Returns null outside a CartProvider: an inquiry-only site mounts none
 * (Storefront Phase 0.2), and the renderer then draws its links, not a bag.
 */
export function useCartAdapter(): CartAdapter | null {
  const cartCtx = useOptionalCart();
  const siteData = useSiteData();

  return useMemo<CartAdapter | null>(() => {
    if (!cartCtx) return null;
    const { cart, setCart } = cartCtx;
    return {
      addToCart: ({ product, variant, quantity }) => {
        const added = handleAddToCart({
          product: rendererProductToTemplates(product),
          selectedVariant: variant,
          quantity,
          cart,
          setCart,
        });
        // `handleAddToCart` returns false for an item with no checkout price.
        // That answer used to be discarded here, so the button animated and
        // nothing joined the bag, with nothing said (H45's "dead button").
        if (!added) {
          toast({
            variant: "destructive",
            title: "Not available online",
            description: UNBUYABLE_ITEM_MESSAGE,
            duration: FAILURE_TOAST_MS,
          });
        }
      },

      buyNow: async ({ product, variant, quantity }) => {
        // Mirrors ProductDetailClient.onBuyNow: build a single-item cart and
        // hand it straight to handleCheckout (VR_Client_API resolves the
        // payments provider server-side and returns the hosted checkout URL).
        const templatesProduct = rendererProductToTemplates(product);
        const resolvedVariant = resolveVariant(variant, templatesProduct) ?? "default";
        const priceID = resolveVariantableString(templatesProduct.checkoutIdentifier ?? templatesProduct.default_price, variant) ?? "";
        const name = getSafeFieldValue(templatesProduct, "name", variant) ?? "";
        const price = getSafeFieldValue(templatesProduct, "price", variant) ?? "";
        const imageUrl = getSafeFieldValue(templatesProduct, "imageUrl", variant) ?? "";

        try {
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
            requiresShipping: shipsOrders(siteData?.businessInfo),
            originUrl: typeof window !== "undefined" ? window.location.origin : "",
          });
        } catch (err) {
          // H45/H33: this hop had NO catch. Every refusal checkout can give
          // (an unbuyable line, a group with no provider active, an upstream
          // wobble) became an unhandled rejection: the spinner stopped, the
          // page stayed put, and the shopper was told nothing. The cart dialog
          // has always shown these; the product page showed none of them.
          //
          // Swallowed deliberately rather than rethrown: the renderer's
          // DetailAddToCart awaits this with no catch of its own, so a rethrow
          // is an unhandled rejection again. The toast IS the handling.
          //
          // `err.message` is the edge route's shopper-facing sentence, which is
          // chosen by status and never echoes upstream prose (see
          // api/checkout/route.ts). It is safe to show as-is.
          toast({
            variant: "destructive",
            title: "Checkout could not start",
            description:
              err instanceof Error && err.message ? err.message : BUY_NOW_FAILED_MESSAGE,
            duration: FAILURE_TOAST_MS,
          });
        }
      },

      getCartCount: () =>
        Object.values(cart || {}).reduce((total, item) => total + (item?.quantity || 0), 0),
    };
  }, [cartCtx, siteData]);
}
