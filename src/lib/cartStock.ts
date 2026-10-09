/**
 * QA-W2-1 (walk W2): the bag caps each line at its stock.
 *
 * Checkout was the only cap. VR_Client_API refuses a line above its stock with
 * a 409 (`createCheckoutSession.js`, `content.checkout.session.out_of_stock`),
 * but the bag let a shopper pick 6 of something with 4 left and then told them
 * to "refresh the page", which changes nothing.
 *
 * The cap is checkout's own tracked-stock rule, `trackedLineStock` below, so
 * the bag and checkout always agree on which lines are capped and where.
 *
 * Pure and free of `@/` imports, so it runs under `node --test`.
 */
import type { Cart } from "../types/Cart";
import type { ShortStockLine } from "./checkoutRequest.ts";

/**
 * CHECKOUT'S TRACKED-STOCK RULE, ported line for line from VR_Client_API
 * `src/api/site/_helpers/resolveProductVariantByPriceId.js` (Stripe) and
 * `resolveSquareVariant.js` (Square), the readers `createCheckoutSession` and
 * `checkoutDispatch` refuse on:
 *
 * 1. The line's VARIANT KEY is the key of the product's checkout-id map whose
 *    value is the line's checkout id. A product whose checkout id is a plain
 *    string has no key: it is single-price.
 * 2. With a key, stock is `stock[key]`, only when that is a number.
 * 3. With no key, stock is `stock` itself, only when it is a number.
 * 4. Anything else is UNTRACKED: no cap. That includes a sized product whose
 *    `stock` is a plain number (checkout ignores it there; the review of #189
 *    found the bag capping it), and a size with no count of its own.
 *
 * It never borrows another size's count: that fallback is what made a card say
 * "Only 4 left" while Large was chosen.
 *
 * The one input Templates cannot see is a Square product's `squareVariations`
 * (VR_Client_API does not send it), so a Square line is judged on the checkout
 * id Templates sends, which is the same id checkout receives.
 */
export function trackedLineStock(stock: unknown, checkoutIds: unknown, lineCheckoutId: string): number | undefined {
  const isMap = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  let count: unknown;
  if (isMap(checkoutIds)) {
    const variantKey = Object.keys(checkoutIds).find((k) => checkoutIds[k] === lineCheckoutId);
    if (variantKey === undefined) return undefined;
    count = isMap(stock) ? stock[variantKey] : undefined;
  } else {
    count = stock;
  }
  if (typeof count !== "number" || !Number.isFinite(count)) return undefined;
  return Math.max(0, Math.floor(count));
}

/** `quantity`, capped at `stock` when stock is tracked. */
export function capQuantity(quantity: number, stock: number | undefined): number {
  return stock === undefined ? quantity : Math.min(quantity, stock);
}

export interface StockAdjustment {
  name: string;
  available: number;
}

/**
 * The bag with every line brought down to its stock (a line with none left is
 * removed), plus what changed so the shopper can be told.
 */
export function clampCartToStock(cart: Cart): { cart: Cart; changed: StockAdjustment[] } {
  const next: Cart = {};
  const changed: StockAdjustment[] = [];
  for (const [key, line] of Object.entries(cart)) {
    const stock = typeof line.stock === "number" ? line.stock : undefined;
    if (stock === undefined || line.quantity <= stock) {
      next[key] = line;
      continue;
    }
    changed.push({ name: line.name, available: stock });
    if (stock > 0) next[key] = { ...line, quantity: stock };
  }
  return { cart: next, changed };
}

/**
 * The bag after checkout NAMED the short lines (Client #117): each named line is
 * set to what is available, and removed at 0. The counts come from the
 * response, never from the stock stored when the item was added, which can be
 * stale. A line is matched on its checkout price id, the same id checkout was
 * sent (the Stripe price, or the Square variation id).
 */
export function applyShortStock(cart: Cart, short: readonly ShortStockLine[]): { cart: Cart; changed: StockAdjustment[] } {
  const availableByPrice = new Map(short.map((s) => [s.priceId, s.available]));
  const next: Cart = {};
  const changed: StockAdjustment[] = [];
  for (const [key, line] of Object.entries(cart)) {
    const available = availableByPrice.get(line.priceID);
    if (available === undefined || line.quantity <= available) {
      next[key] = line;
      continue;
    }
    changed.push({ name: line.name, available });
    if (available > 0) next[key] = { ...line, quantity: available, stock: available };
  }
  return { cart: next, changed };
}

/** Shown when checkout refuses for stock and the bag cannot tell which line. */
export const STOCK_REFUSAL_FALLBACK_COPY =
  "Some of your bag has sold out since you added it. Lower the amount, then try again.";

/** What the shopper reads after the bag was brought down to stock. */
export function stockAdjustedMessage(changed: readonly StockAdjustment[]): string {
  if (changed.length === 0) return STOCK_REFUSAL_FALLBACK_COPY;
  const sentences = changed.map(({ name, available }) =>
    available > 0 ? "Only " + available + " " + name + " left." : name + " has sold out.",
  );
  return sentences.join(" ") + " We've updated your bag.";
}
