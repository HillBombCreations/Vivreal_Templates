import type { DetailProductData } from "@hillbombcreations/site-renderer";
import type { Product } from "@/types/Products";

/**
 * Maps the Templates `Product` → renderer `DetailProductData`. Field names are
 * shared across both repos, so this is a direct structural pass-through that
 * also carries `stock` + `lowStockThreshold` for the renderer's per-variant
 * stock display.
 *
 * Extracted from the `'use client'` component so the projection is test-pinned
 * (`node --test` can't load .tsx): silently dropping a field here —
 * `checkoutIdentifier` especially — would break the Square detail-route buy
 * flow with no compile error.
 */
export function templatesProductToRenderer(product: Product, siteLogo: string): DetailProductData {
  return {
    _id: product._id,
    name: product.name,
    price: product.price,
    description: product.description,
    // Fall back to the site logo when the product has no image — matches the
    // products list (ProductsPageClient).
    imageUrl: product.imageUrl || siteLogo,
    // srcset only for the non-variant (flat string) image — when imageUrl is a
    // variant map (or the siteLogo fallback) there is no flat derivative set.
    imageSrcSet:
      typeof product.imageUrl === "string" && typeof product.imageSrcSet === "string"
        ? product.imageSrcSet || undefined
        : undefined,
    // Gallery has NO siteLogo fallback: an empty gallery signals the hero to
    // use the single-image (imageUrl) path. Only real galleries populate it.
    gallery: product.gallery,
    // Index-aligned only for a FLAT gallery (variant galleries carry no flat srcset).
    gallerySrcSet: Array.isArray(product.gallery) ? product.gallerySrcSet : undefined,
    link: product.link,
    productType: product.productType,
    buttonLabel: product.buttonLabel,
    usingVariant: product.usingVariant,
    default_price: product.default_price,
    checkoutIdentifier: product.checkoutIdentifier,
    quantityOptions: product.quantityOptions,
    quantityUnit: product.quantityUnit,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    // Public-sale DISPLAY fields (plan §5). Display only — Stripe applies the
    // authoritative discount at checkout. Absent ⇒ detail price renders as before.
    salePercent: product.salePercent,
    saleAmount: product.saleAmount,
    saleStart: product.saleStart,
    saleEnd: product.saleEnd,
  };
}
