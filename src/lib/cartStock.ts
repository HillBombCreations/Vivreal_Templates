/**
 * QA-W2-1 (walk W2): the bag caps each line at its stock.
 *
 * Checkout was the only cap. VR_Client_API refuses a line above its stock with
 * a 409 (`createCheckoutSession.js`, `content.checkout.session.out_of_stock`),
 * but the bag let a shopper pick 6 of something with 4 left and then told them
 * to "refresh the page", which changes nothing.
 *
 * The cap is checkout's own tracked-stock rule, `trackedStock` below, so
 * the bag and checkout always agree on which lines are capped and where.
 *
 * Pure and free of `@/` imports, so it runs under `node --test`.
 */
import type { Cart } from "../types/Cart";
import type { ShortStockLine } from "./checkoutRequest.ts";

export type StockProvider = "stripe" | "square";

export interface TrackedStock {
  tracked: boolean;
  /** The count checkout compares against, as stored; `null` when untracked. */
  available: number | null;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Stripe: the `default_price` map's key whose value is the line's price id (`|| null`, as in Client). */
function stripeVariantKey(objectValue: Record<string, unknown>, lineId: string): string | null {
  const defaultPrice = objectValue.default_price;
  if (!isPlainObject(defaultPrice)) return null;
  return Object.keys(defaultPrice).find((k) => defaultPrice[k] === lineId) || null;
}

/** Square: the `squareVariations` entry with the line's id, when the `price` map has that size. */
function squareVariantKey(objectValue: Record<string, unknown>, lineId: string): string | null {
  const price = objectValue.price;
  if (!isPlainObject(price)) return null;
  const variations = Array.isArray(objectValue.squareVariations) ? objectValue.squareVariations : [];
  const match = variations.find(
    (v: unknown) => isPlainObject(v) && v.variationId === lineId && typeof v.name === "string",
  ) as { name: string } | undefined; // the find above proved `name` is a string
  return match && Object.prototype.hasOwnProperty.call(price, match.name) ? match.name : null;
}

/**
 * Does checkout find a product for this line at all? The two resolvers' own
 * queries: Stripe matches `default_price` equal to the line's id, or a
 * `default_price` map holding it; Square matches `variationId`, or a
 * `squareVariations` entry with it. No match means checkout refuses the line as
 * unavailable, whatever the stock says.
 */
function holdsLine(provider: StockProvider, objectValue: Record<string, unknown>, lineId: string): boolean {
  if (provider === "square") {
    if (objectValue.variationId === lineId) return true;
    const variations = Array.isArray(objectValue.squareVariations) ? objectValue.squareVariations : [];
    return variations.some((v: unknown) => isPlainObject(v) && v.variationId === lineId);
  }
  const defaultPrice = objectValue.default_price;
  if (defaultPrice === lineId) return true;
  return isPlainObject(defaultPrice) && Object.values(defaultPrice).includes(lineId);
}

/**
 * CHECKOUT'S TRACKED-STOCK RULE, ported line for line from VR_Client_API, the
 * two readers checkout refuses on:
 * - Stripe, `src/api/site/_helpers/resolveProductVariantByPriceId.js`: the
 *   variant key is the `default_price` map's key holding the line's price id.
 * - Square, `src/api/site/_helpers/resolveSquareVariant.js`: the variant key is
 *   the name of the `squareVariations` entry holding the line's variation id,
 *   when the `price` map carries that name.
 * First, a line whose id the product does not hold is `null`: checkout finds
 * no product for it and refuses it as unavailable.
 * Then, for both: with a key, stock is `stock[key]` when it is a number; with no
 * key, stock is `stock` itself when it is a number; anything else is untracked.
 *
 * The SAME cases run on both sides from `test/fixtures/tracked-stock-cases.json`
 * (Templates `cartStock.parity.test.ts`; Client keeps an identical copy), so a
 * change to either rule fails one side's tests.
 */
export function trackedStock(
  provider: StockProvider,
  objectValue: Record<string, unknown>,
  lineId: string,
): TrackedStock | null {
  if (!holdsLine(provider, objectValue, lineId)) return null;
  const variantKey =
    provider === "square" ? squareVariantKey(objectValue, lineId) : stripeVariantKey(objectValue, lineId);
  const stockField = objectValue.stock;
  let stock: unknown;
  if (variantKey != null) {
    const holder =
      provider === "square"
        ? stockField && typeof stockField === "object"
        : isPlainObject(stockField);
    stock = holder ? (stockField as Record<string, unknown>)[variantKey] : undefined; // `holder` proved it is an object
  } else {
    stock = stockField;
  }
  return typeof stock === "number" ? { tracked: true, available: stock } : { tracked: false, available: null };
}

/**
 * The bag's cap for one line: checkout's rule, fed what the bag has.
 *
 * WHICH PROVIDER. A Stripe product carries `default_price`; a Square product
 * does not, and carries its checkout ids in `checkoutIdentifier` instead: a
 * plain string for one price, or (renderer 1.84.2, `squareCheckoutIdentifier`)
 * a `{ size: variationId }` map built from the product's `squareVariations`.
 *
 * A SIZED SQUARE PRODUCT is judged exactly when that map is present: the map
 * IS `squareVariations` (size name to variation id), so it is handed to the
 * rule as such and checkout's own query and size lookup run on it. The review
 * of `7087197` caught the bag reading that map as a Stripe product and refusing
 * every sized Square add. With only a scalar id and a `price` map (an older
 * payload with no `squareVariations`), the size checkout picks cannot be known
 * here, so that line gets no cap: the bag never refuses what checkout would
 * sell, and checkout's 409 `items` brings the line down if it was short.
 *
 * A non-finite count never refuses at checkout (`stock < requested` is false),
 * so it is no cap here either.
 *
 * Answers the cap, `undefined` for no cap, or `null` when checkout would find
 * no product for the line (it cannot be sold, so it never joins the bag).
 */
export function bagLineStock(
  product: { default_price?: unknown; checkoutIdentifier?: unknown; price?: unknown; stock?: unknown },
  lineId: string,
): number | undefined | null {
  const ids = product.checkoutIdentifier;
  const square = product.default_price == null && (typeof ids === "string" || isPlainObject(ids));
  let verdict: TrackedStock | null;
  if (!square) {
    verdict = trackedStock("stripe", { default_price: product.default_price, stock: product.stock }, lineId);
  } else if (isPlainObject(ids)) {
    const squareVariations = Object.entries(ids).map(([name, variationId]) => ({ name, variationId }));
    verdict = trackedStock("square", { price: product.price, squareVariations, stock: product.stock }, lineId);
  } else {
    if (isPlainObject(product.price)) return undefined;
    // A Square line's id IS the product's variation id (`transformProduct`).
    verdict = trackedStock("square", { variationId: ids, price: product.price, stock: product.stock }, lineId);
  }
  if (verdict === null) return null;
  if (verdict.available === null || !Number.isFinite(verdict.available)) return undefined;
  return Math.max(0, Math.floor(verdict.available));
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
