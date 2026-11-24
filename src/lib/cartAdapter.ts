"use client";

import { useMemo } from "react";
import type { CartAdapter } from "@hillbombcreations/site-renderer";
import { useOptionalCart } from "@/contexts/CartContext";
import { useSiteData } from "@/contexts/SiteDataContext";
import {
  handleAddToCart,
  handleCheckout,
  BUY_NOW_FAILED_MESSAGE,
  addRefusal,
  buyNowCart,
  fetchCartQuote,
  CheckoutShopRuleError,
} from "@/lib/utils/cartUtils";
import { quoteAsksQuestion } from "@/lib/cart/cartAsks";
import { resolveVariantableString } from "@/lib/utils/variantUtils";
import { rendererProductToTemplates } from "@/lib/cartProduct";
import { toast } from "@/hooks/use-toast";
import { shipsOrders } from "@/lib/shipping";
import { deliveryConfigOf } from "@hillbombcreations/site-renderer";
import { cartNeedsChoices, readCartSettings } from "@/lib/cart/cartSettings";

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
        const templatesProduct = rendererProductToTemplates(product);
        const added = handleAddToCart({
          product: templatesProduct,
          selectedVariant: variant,
          quantity,
          cart,
          setCart,
        });
        // `handleAddToCart` returns false for an item with no checkout price,
        // and for a size that has sold out. That answer used to be discarded
        // here, so the button animated and nothing joined the bag, with nothing
        // said (H45's "dead button"). `addRefusal` says which it was.
        if (!added) {
          toast({
            variant: "destructive",
            // F385: the bag is passed so a shared count already in it reads as sold out.
            ...addRefusal(templatesProduct, variant, cart),
            duration: FAILURE_TOAST_MS,
          });
        }
      },

      buyNow: async ({ product, variant, quantity }) => {
        // Mirrors ProductDetailClient.onBuyNow: build a single-item cart and
        // hand it straight to handleCheckout (VR_Client_API resolves the
        // payments provider server-side and returns the hosted checkout URL).
        const templatesProduct = rendererProductToTemplates(product);
        const priceID = resolveVariantableString(templatesProduct.checkoutIdentifier ?? templatesProduct.default_price, variant) ?? "";
        // Adds the item and opens the cart, where the shopper decides.
        const addAndOpenCart = () => {
          const added = handleAddToCart({ product: templatesProduct, selectedVariant: variant, quantity, cart, setCart });
          if (added) cartCtx.setOpenCartMenu(true);
          else toast({ variant: "destructive", ...addRefusal(templatesProduct, variant, cart), duration: FAILURE_TOAST_MS });
        };
        // Owner ideas T13/T15: with a note, a pickup time, a minimum or a
        // choice of pickup and delivery, the shopper decides in the cart, so
        // Buy now adds the item and opens it rather than skipping past them.
        // Release C (SQP-T3, FP1.4): the same for the newsletter box (either
        // provider) and, on a Square shop, a product question, which only the
        // cart can ask; the quote says whether this product has one.
        const settings = readCartSettings(siteData?.cart);
        const ways = { deliveryOn: deliveryConfigOf(siteData?.pageConfigs)?.enabled === true, ships: shipsOrders(siteData?.businessInfo) };
        const square = siteData?.paymentsProvider === "square";
        const needsCart =
          cartNeedsChoices(settings, ways) ||
          (square && cartNeedsChoices(settings, ways, { square, lineAsks: quoteAsksQuestion(await fetchCartQuote([{ price: priceID, quantity }])) }));
        if (needsCart) {
          addAndOpenCart();
          return;
        }
        try {
          await handleCheckout({
            // D-P9-5: `buyNowCart` marks a product with one price and a count per option, so its option is sent.
            cart: buyNowCart(templatesProduct, variant, quantity, priceID),
            requiresShipping: shipsOrders(siteData?.businessInfo),
            originUrl: typeof window !== "undefined" ? window.location.origin : "",
          });
        } catch (err) {
          // Release C (SQP-T3, FP1.4): the quote did not know of the question
          // (the owner turned it on just now). Never a dead end: the item goes
          // in the cart, which opens with the box.
          if (err instanceof CheckoutShopRuleError && err.code === "QUESTION_REQUIRED") {
            addAndOpenCart();
            return;
          }
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
