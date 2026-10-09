/**
 * QA-W2-1 (walk W2): the bag caps each line at its stock.
 *
 * Checkout was the only cap. VR_Client_API refuses a line above its stock with
 * a 409 (`createCheckoutSession.js`, `content.checkout.session.out_of_stock`),
 * but the bag let a shopper pick 6 of something with 4 left and then told them
 * to "refresh the page", which changes nothing.
 *
 * THE STOCK RULE MATCHES CHECKOUT'S. A line is capped only when its stock is
 * TRACKED: a plain number for a product with no sizes, or a number stored under
 * the chosen size in a per-size map (`{ "Small": 4 }`). A size with no number
 * is untracked, so it has no cap, exactly as checkout sells it. It never falls
 * back to another size's count: that fallback is what made a card say "Only 4
 * left" while Large was chosen.
 *
 * Pure and free of `@/` imports, so it runs under `node --test`.
 */
import type { Cart } from "../types/Cart";
import type { ShortStockLine } from "./checkoutRequest.ts";

type StockValue = number | Record<string, unknown> | undefined | null;

/** The chosen line's stock, or `undefined` when it is not tracked. */
export function resolveLineStock(stock: StockValue | unknown, variant: string): number | undefined {
  const count =
    typeof stock === "number"
      ? stock
      : stock && typeof stock === "object" && !Array.isArray(stock)
        ? (stock as Record<string, unknown>)[variant]
        : undefined;
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
