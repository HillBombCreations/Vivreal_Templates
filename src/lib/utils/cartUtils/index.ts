import type { Cart, CartItem } from "@/types/Cart";
import type { Product } from "@/types/Products";
// Explicit index.ts path (allowed by tsconfig `allowImportingTsExtensions`) so
// this module loads under the repo's `node --test` harness, which does no
// extensionless / directory resolution — see `checkoutIdentifier.test.ts`.
import { resolveVariant, getSafeFieldValue, resolveVariantableString } from "../variantUtils/index.ts";
import type { Dispatch, SetStateAction } from "react";
import { parseCartQuote, type CartQuote } from "../../cartQuote.ts";
import { capQuantity, resolveLineStock } from "../../cartStock.ts";
import { CHECKOUT_OUT_OF_STOCK } from "../../checkoutRequest.ts";

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
}: AddToCartProps): boolean {
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
  // Storefront Phase 0.2: an item with no checkout price (a template-seeded
  // collection item) cannot be bought, so it never becomes a bag line.
  if (!priceID.trim()) return false;
  // Resolve the unit for THIS line's variant so the cart stores a plain string
  // (e.g. "lb"), never the whole variant→unit map.
  const unit = resolveVariantableString(product.quantityUnit, selectedVariant);

  // QA-W2-1: the bag never holds more than the chosen size's tracked stock,
  // the same cap checkout enforces. Nothing left means nothing to add.
  const stock = resolveLineStock(product.stock, variant);
  if (stock === 0) return false;

  const existing = cart[cartKey];
  const newQty = capQuantity(existing ? existing.quantity + quantity : quantity, stock);

  const item: CartItem = {
    _id: product._id,
    quantity: newQty,
    name,
    price,
    priceID,
    imageUrl,
    variant,
    ...(unit && { unit }),
    ...(stock !== undefined ? { stock } : {}),
  };

  setCart((prev) => ({ ...prev, [cartKey]: item }));
  return true;
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

/**
 * QA-W2-1: thrown when checkout refused because a line is above its stock.
 * The bag catches it, brings each line down to its stock and says what changed.
 */
export class CheckoutStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutStockError";
  }
}

/** Thrown when checkout-time re-validation of the promo code fails (plan §5.5). */
export class CheckoutCouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutCouponError";
  }
}

/** Storefront Phase 0.2: shown when a bag holds a line with no checkout price. */
export const UNBUYABLE_LINE_MESSAGE =
  "Something in your bag can't be bought online yet. Remove it, then check out.";

/**
 * Shown when Add to cart refuses because the item carries no checkout price.
 *
 * `handleAddToCart` has always returned false for these, and the product page
 * threw that answer away, so the button moved and nothing happened.
 */
export const UNBUYABLE_ITEM_MESSAGE =
  "This one can't be bought online yet. Get in touch and we'll sort it out.";

/**
 * Shown when Buy now cannot start checkout and the server sent no words of its
 * own. Every version of this says what to DO next: a message that only says no
 * leaves the shopper on the same dead button.
 */
export const BUY_NOW_FAILED_MESSAGE =
  "We could not start checkout. Refresh the page, then try again.";

/** Thrown before any request when a bag line has no checkout price. */
export class CheckoutLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutLineError";
  }
}

export async function handleCheckout({
  cart,
  requiresShipping,
  originUrl,
  code,
}: CheckoutProps): Promise<void> {
  // Storefront Phase 0.2: /api/checkout refuses an empty price with a 400. A
  // bag saved before this fix can still hold such a line, so refuse here, before
  // any request, with words the cart dialog shows as they are.
  if (Object.values(cart).some((item) => !item.priceID?.trim())) {
    throw new CheckoutLineError(UNBUYABLE_LINE_MESSAGE);
  }

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
  if (data.reason === CHECKOUT_OUT_OF_STOCK) throw new CheckoutStockError(message);
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

/**
 * How long the bag waits for a quote. Past this it behaves exactly as for a
 * failed quote: list prices, never a sale, and Checkout is never held up.
 */
export const CART_QUOTE_TIMEOUT_MS = 3_000;

/**
 * F4: the bag's live prices from the `/api/cart-quote` edge route (then
 * VR_Client_API `POST /tenant/cartQuote`, release plan contract C6). Answers the
 * parsed quote, or `null` when the quote failed for any reason (network, a
 * non-200, an unreadable body, or no answer within `timeoutMs`). `null` is not
 * an error to the bag: it shows list prices, which are never below what
 * checkout charges, so nothing is thrown.
 *
 * The timeout races the request rather than trusting the abort alone, so even
 * a transport that ignores the signal cannot hold the Checkout press.
 */
export async function fetchCartQuote(
  cartLineItems: CartLineItemInput[],
  timeoutMs: number = CART_QUOTE_TIMEOUT_MS,
): Promise<CartQuote | null> {
  if (cartLineItems.length === 0) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  const request = (async (): Promise<CartQuote | null> => {
    try {
      const res = await fetch("/api/cart-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartLineItems }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return parseCartQuote(await res.json());
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([request, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}
