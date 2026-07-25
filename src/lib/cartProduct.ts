import type { DetailProductData } from "@hillbombcreations/site-renderer";
import type { Product } from "@/types/Products";

/**
 * Maps the renderer's `DetailProductData` back to the Templates `Product`
 * shape. The two share field names, so this is a structural narrowing — the
 * only divergence is that the renderer marks several fields optional that the
 * Templates `Product` requires, so we coalesce to sensible empties.
 *
 * Extracted from `cartAdapter.ts` (a `'use client'` module `node --test` can't
 * load) so the projection is test-pinned: silently dropping a field here —
 * `checkoutIdentifier` especially — would break Square checkout with no
 * compile error (the cart would resolve an empty `priceID`).
 */
export function rendererProductToTemplates(product: DetailProductData): Product {
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
    checkoutIdentifier: product.checkoutIdentifier,
    quantityOptions: product.quantityOptions,
    quantityUnit: product.quantityUnit,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
  };
}
