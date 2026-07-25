import type { Cart, CartItem } from "@/types/Cart";
import type { Product } from "@/types/Products";
// Explicit index.ts path (allowed by tsconfig `allowImportingTsExtensions`) so
// this module loads under the repo's `node --test` harness, which does no
// extensionless / directory resolution — see `checkoutIdentifier.test.ts`.
import { resolveVariant, getSafeFieldValue, resolveVariantableString } from "../variantUtils/index.ts";
import type { Dispatch, SetStateAction } from "react";

interface AddToCartProps {
  product: Product;
  selectedVariant: string | null;
  quantity: number;
  cart: Cart;
  setCart: Dispatch<SetStateAction<Cart>>;
}

export function handleAddToCart({
  product,
  selectedVariant,
  quantity,
  cart,
  setCart,
}: AddToCartProps): void {
  const variant = resolveVariant(selectedVariant, product) ?? "default";
  const cartKey = `${product._id}_${variant}`;
  const baseName = getSafeFieldValue(product, "name", selectedVariant) ?? "";
  const name = variant !== "default" ? `${baseName} (${variant})` : baseName;
  const price = getSafeFieldValue(product, "price", selectedVariant) ?? "";
  const imageUrl = getSafeFieldValue(product, "imageUrl", selectedVariant) ?? "";
  // `checkoutIdentifier ?? default_price` — provider-agnostic checkout id
  // (Stripe price id / Square variationId); identical value on legacy Stripe
  // products, which only carry `default_price`.
  const priceID = resolveVariantableString(product.checkoutIdentifier ?? product.default_price, selectedVariant) ?? "";
  // Resolve the unit for THIS line's variant so the cart stores a plain string
  // (e.g. "lb"), never the whole variant→unit map.
  const unit = resolveVariantableString(product.quantityUnit, selectedVariant);

  const existing = cart[cartKey];
  const newQty = existing ? existing.quantity + quantity : quantity;

  const item: CartItem = {
    _id: product._id,
    quantity: newQty,
    name,
    price,
    priceID,
    imageUrl,
    variant,
    ...(unit && { unit }),
  };

  setCart((prev) => ({ ...prev, [cartKey]: item }));
}

interface CheckoutProps {
  cart: Cart;
  requiresShipping: boolean;
  originUrl: string;
  /**
   * Applied promo code (advisory). Carried through to VR_Client_API, which
   * RE-VALIDATES it server-side before applying via Stripe (plan §1.3). Never
   * trusted as-is — the client only controls the code string + quantities.
   */
  code?: string;
}

/** Thrown when checkout-time re-validation of the promo code fails (plan §5.5). */
export class CheckoutCouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutCouponError";
  }
}

export async function handleCheckout({
  cart,
  requiresShipping,
  originUrl,
  code,
}: CheckoutProps): Promise<void> {
  const products = Object.values(cart).map((item) => ({
    price: item.priceID,
    quantity: item.quantity,
    name: item.name,
  }));

  if (products.length === 0) return;

  const trimmedCode = typeof code === "string" ? code.trim().toUpperCase() : "";

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products,
      requiresShipping,
      originUrl,
      // Only include the code when present; omitted entirely otherwise so
      // no-code checkouts send a byte-identical payload to before this feature.
      ...(trimmedCode ? { code: trimmedCode } : {}),
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok && typeof data.url === "string" && data.url.startsWith("https://")) {
    window.location.replace(data.url);
    return;
  }

  // Re-validation failed (e.g. the code's limit was hit between apply and
  // checkout, or the sale ended). Surface a clear error so the caller can clear
  // the code and never proceeds silently (plan §5.5 / R2).
  const message =
    (typeof data.error === "string" && data.error) ||
    "Checkout could not be started. Please try again.";
  throw new CheckoutCouponError(message);
}

export interface CouponPreview {
  valid: boolean;
  discountType?: "percent" | "fixed" | null;
  discountValue?: number | null;
  appliesToLineIds?: string[];
  newSubtotal?: number | null;
  reason?: string;
}

export interface CartLineItemInput {
  /** Stripe price id. */
  price: string;
  quantity: number;
}

/**
 * Validate a promo code against the current cart via the `/api/validate-coupon`
 * edge route (→ VR_Client_API). Returns the server PREVIEW. The cart owns
 * applied-code state + persistence; this helper is a thin transport.
 */
export async function validateCoupon(
  code: string,
  cartLineItems: CartLineItemInput[]
): Promise<CouponPreview> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed || cartLineItems.length === 0) {
    return { valid: false, reason: "not_found" };
  }

  const res = await fetch("/api/validate-coupon", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: trimmed, cartLineItems }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Transport/validation error — treat as an invalid code so the cart shows
    // the generic error copy rather than crashing.
    return { valid: false, reason: data?.error ? "error" : "not_found" };
  }

  return data as CouponPreview;
}
