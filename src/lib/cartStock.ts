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
 * D-P9-5 S1, Client's `optionStock.js` `isOneCountPerOption`: the price is not a
 * map (Stripe `default_price`, Square `price`) AND `stock` is a plain object.
 * A product priced per option, or with one plain count, is never this shape.
 */
function isOneCountPerOption(provider: StockProvider, objectValue: Record<string, unknown>): boolean {
  const price = provider === "square" ? objectValue.price : objectValue.default_price;
  return !isPlainObject(price) && isPlainObject(objectValue.stock);
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
 * F385 (release B, SW-B25 option A): a STRIPE product priced per option (the
 * `default_price` map) whose `stock` is ONE number counts that number for every
 * option. The line is tracked against it, and the bag compares the SUM of the
 * product's lines with it (`isSharedStock`, `lineCap`, `clampCartToStock`).
 * F393 (SW-B25 amended, T-385S): the same for a SQUARE product priced per size
 * (the `price` map, with `squareVariations`), as Client's
 * `resolveSquareVariant.js` (CL-STK4). A per-option map, a missing or
 * non-numeric stock, and a line with no option key keep the rule above.
 *
 * D-P9-5 (release C, vivreal-hq design-dp95-per-size-stock.md S1, S4): a
 * product with ONE checkout id and stock counted PER OPTION (`isOneCountPerOption`)
 * is judged by the option the cart line names, as Client's `optionStock.js`
 * `optionEntries`: an option that is an own key of `stock` is tracked at its
 * count when that is a number and untracked otherwise; no option, or one the
 * stock does not count, is `null` (checkout refuses it as no longer available).
 * On every other product `option` is never read.
 *
 * The SAME cases run on both sides from `test/fixtures/tracked-stock-cases.json`
 * (Templates `cartStock.parity.test.ts`; Client keeps an identical copy), so a
 * change to either rule fails one side's tests.
 */
export function trackedStock(
  provider: StockProvider,
  objectValue: Record<string, unknown>,
  lineId: string,
  option?: string,
): TrackedStock | null {
  if (!holdsLine(provider, objectValue, lineId)) return null;
  if (isOneCountPerOption(provider, objectValue)) {
    const counts = objectValue.stock as Record<string, unknown>; // `isOneCountPerOption` proved it is a plain object
    if (typeof option !== "string" || !Object.hasOwn(counts, option)) return null;
    const count = counts[option];
    return typeof count === "number" ? { tracked: true, available: count } : { tracked: false, available: null };
  }
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
    // F385 (Stripe), F393 (Square): a plain count on a per-option product is the one shared count.
    if (typeof stockField === "number") stock = stockField;
  } else {
    stock = stockField;
  }
  return typeof stock === "number" ? { tracked: true, available: stock } : { tracked: false, available: null };
}

/** What the bag knows of a product: the fields checkout's rule reads. */
type BagProduct = { default_price?: unknown; checkoutIdentifier?: unknown; price?: unknown; stock?: unknown };

/** A Square product carries no `default_price` and its checkout ids in `checkoutIdentifier` (see `bagLineStock`). */
function isSquareBagProduct(product: BagProduct): boolean {
  const ids = product.checkoutIdentifier;
  return product.default_price == null && (typeof ids === "string" || isPlainObject(ids));
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
 * D-P9-5: `option` is the line's own option (the size the shopper picked). It
 * is read only for a product with one checkout id and stock counted per option,
 * whose line is then capped at that option's count (`trackedStock`).
 *
 * Answers the cap, `undefined` for no cap, or `null` when checkout would find
 * no product for the line (it cannot be sold, so it never joins the bag).
 */
export function bagLineStock(
  product: BagProduct,
  lineId: string,
  option?: string,
): number | undefined | null {
  const ids = product.checkoutIdentifier;
  let verdict: TrackedStock | null;
  if (!isSquareBagProduct(product)) {
    verdict = trackedStock("stripe", { default_price: product.default_price, stock: product.stock }, lineId, option);
  } else if (isPlainObject(ids)) {
    const squareVariations = Object.entries(ids).map(([name, variationId]) => ({ name, variationId }));
    verdict = trackedStock("square", { price: product.price, squareVariations, stock: product.stock }, lineId, option);
  } else {
    if (isPlainObject(product.price)) return undefined;
    // A Square line's id IS the product's variation id (`transformProduct`).
    verdict = trackedStock("square", { variationId: ids, price: product.price, stock: product.stock }, lineId, option);
  }
  if (verdict === null) return null;
  if (verdict.available === null || !Number.isFinite(verdict.available)) return undefined;
  return Math.max(0, Math.floor(verdict.available));
}

/**
 * D-P9-5 (S6): does each line of this product draw on its OWN option's count,
 * the product having one checkout id and `stock` counted per option? Such a
 * line carries `optionStock` and sends its option to checkout (S2), which
 * refuses the line without one. Judged as `bagLineStock` judges the provider.
 */
export function isOptionStock(product: BagProduct): boolean {
  return isSquareBagProduct(product)
    ? isOneCountPerOption("square", { price: product.price, stock: product.stock })
    : isOneCountPerOption("stripe", { default_price: product.default_price, stock: product.stock });
}

/** `quantity`, capped at `stock` when stock is tracked. */
export function capQuantity(quantity: number, stock: number | undefined): number {
  return stock === undefined ? quantity : Math.min(quantity, stock);
}

/**
 * F385 (SW-B25 option A): does every line of this product draw on ONE count? A
 * Stripe product priced per option (`default_price` a map) whose `stock` is a
 * single number. F393 (SW-B25 amended, T-385S): or a Square product priced per
 * size, which the bag knows by `bagLineStock`'s own test (no `default_price`,
 * a size-to-variation `checkoutIdentifier` map) plus a `price` map. A Square
 * product with only a scalar id stays uncapped (`bagLineStock`), so never shared.
 */
export function isSharedStock(product: {
  default_price?: unknown;
  checkoutIdentifier?: unknown;
  price?: unknown;
  stock?: unknown;
}): boolean {
  if (typeof product.stock !== "number") return false;
  if (product.default_price != null) return isPlainObject(product.default_price);
  return isPlainObject(product.checkoutIdentifier) && isPlainObject(product.price);
}

/**
 * The shared count of `productId` in the bag and how much of it the lines
 * other than `exceptKey` already hold. A shared pool is the product's lines
 * that carry `sharedStock`; its count is the lowest one they stored, so a
 * stale higher reading never lets the sum past a newer lower one.
 */
function sharedPool(cart: Cart, productId: string, exceptKey: string): { count: number | undefined; held: number } {
  let count: number | undefined;
  let held = 0;
  for (const [key, line] of Object.entries(cart)) {
    if (line._id !== productId || !line.sharedStock || typeof line.stock !== "number") continue;
    count = count === undefined ? line.stock : Math.min(count, line.stock);
    if (key !== exceptKey) held += line.quantity;
  }
  return { count, held };
}

/**
 * What the shared count of `productId` leaves for the line at `key`, given a
 * count read now (`stock`) and the product's other lines in the bag.
 */
export function sharedAllowance(cart: Cart, productId: string, key: string, stock: number): number {
  const { count, held } = sharedPool(cart, productId, key);
  return Math.max(0, Math.min(stock, count ?? stock) - held);
}

/**
 * The most the line at `key` may hold: its own stock, or on a shared line what
 * the shared count leaves after the product's other lines. `undefined` when
 * the line is untracked (no cap).
 */
export function lineCap(cart: Cart, key: string): number | undefined {
  const line = cart[key];
  if (!line || typeof line.stock !== "number") return undefined;
  return line.sharedStock ? sharedAllowance(cart, line._id, key, line.stock) : line.stock;
}

/**
 * The bag's quantity control (T-385 review B1): what the line at `key` moves to
 * when the shopper picks `nextQty`. A decrease is taken as asked, even when a
 * shared count now leaves the line less than it holds; an increase stops at
 * the line's cap and never takes the line below where it is. 0 or less means
 * the caller removes the line: a line of 0 is never written.
 *
 * F392 N5 (release C): a stored line with no numeric quantity (no writer makes
 * one, the type forbids it) is never an increase, so trash and "-" still
 * remove it, as they did before T-385, rather than write a quantity of NaN.
 */
export function nextLineQuantity(cart: Cart, key: string, nextQty: number): number {
  const line = cart[key];
  if (!line || !(nextQty > line.quantity)) return nextQty;
  return Math.max(line.quantity, capQuantity(nextQty, lineCap(cart, key)));
}

/** Is the line at `key` at its cap (so its "+" is off)? Never for an untracked line. */
export function atLineCap(cart: Cart, key: string): boolean {
  const cap = lineCap(cart, key);
  return cap !== undefined && (cart[key]?.quantity || 0) >= cap;
}

export interface StockAdjustment {
  name: string;
  available: number;
}

/**
 * The bag with every line brought down to its stock (a line with none left is
 * removed), plus what changed so the shopper can be told. Lines that share one
 * count (F385) are brought within it together, earlier lines first: each keeps
 * what the count leaves after the lines before it.
 */
export function clampCartToStock(cart: Cart): { cart: Cart; changed: StockAdjustment[] } {
  const next: Cart = {};
  const changed: StockAdjustment[] = [];
  const used = new Map<string, number>();
  for (const [key, line] of Object.entries(cart)) {
    const own = typeof line.stock === "number" ? line.stock : undefined;
    const shared = own !== undefined && line.sharedStock === true;
    let stock = own;
    if (shared) {
      const { count } = sharedPool(cart, line._id, key);
      stock = Math.max(0, (count ?? own) - (used.get(line._id) ?? 0));
    }
    if (stock === undefined || line.quantity <= stock) {
      next[key] = line;
      if (shared) used.set(line._id, (used.get(line._id) ?? 0) + line.quantity);
      continue;
    }
    changed.push({ name: line.name, available: stock });
    if (stock > 0) next[key] = { ...line, quantity: stock };
    if (shared) used.set(line._id, (used.get(line._id) ?? 0) + stock);
  }
  return { cart: next, changed };
}

/**
 * The bag after checkout NAMED the short lines (Client #117): each named line is
 * set to what is available, and removed at 0. The counts come from the
 * response, never from the stock stored when the item was added, which can be
 * stale. A line is matched on its checkout price id, the same id checkout was
 * sent (the Stripe price, or the Square variation id).
 *
 * A SHARED line (F385, SW-B25 (5)): checkout reports its `available` as what
 * the shared count leaves AFTER the product's lines before it, in bag order,
 * which is the order checkout was sent. That is a net number, not the count,
 * so the line stores `available` plus what the product's earlier lines keep:
 * the whole count, which `lineCap` and the next add subtract the other lines
 * from (T-385 review B2). Every other line stores `available` as before.
 *
 * F392 N6 (release C): checkout's answer is the whole shared count of every
 * product it names a shared line of, so EVERY shared line of that product
 * left in the bag stores it, not only a line that was brought down. Before, a
 * refusal that only removed lines, or named a line it kept, left the other
 * lines on their older, higher count: "+" could pass the real count and
 * checkout refused again (never an oversell; the server holds).
 *
 * D-P9-5 (S5): on a product with one checkout id and stock counted per option,
 * every line shares the price id, so checkout names the short one by its
 * `option` too. An entry naming an option matches only the line of that price
 * and that option (`variant`); the product's other options are left alone. An
 * entry with no option matches by price, as before.
 */
export function applyShortStock(cart: Cart, short: readonly ShortStockLine[]): { cart: Cart; changed: StockAdjustment[] } {
  const availableByPrice = new Map<string, number>();
  const availableByOption = new Map<string, Map<string, number>>();
  for (const s of short) {
    if (s.option === undefined) {
      availableByPrice.set(s.priceId, s.available);
      continue;
    }
    const options = availableByOption.get(s.priceId) ?? new Map<string, number>();
    options.set(s.option, s.available);
    availableByOption.set(s.priceId, options);
  }
  const next: Cart = {};
  const changed: StockAdjustment[] = [];
  /** What each product's lines so far keep, as checkout counted them. */
  const keptBefore = new Map<string, number>();
  /** The whole shared count checkout reported, per product it named a shared line of. */
  const sharedCount = new Map<string, number>();
  for (const [key, line] of Object.entries(cart)) {
    const before = keptBefore.get(line._id) ?? 0;
    const available = availableByOption.get(line.priceID)?.get(line.variant) ?? availableByPrice.get(line.priceID);
    if (available !== undefined && line.sharedStock && !sharedCount.has(line._id)) {
      sharedCount.set(line._id, available + before);
    }
    if (available === undefined || line.quantity <= available) {
      next[key] = line;
      keptBefore.set(line._id, before + line.quantity);
      continue;
    }
    changed.push({ name: line.name, available });
    if (available > 0) {
      const stock = line.sharedStock ? available + before : available;
      next[key] = { ...line, quantity: available, stock };
      keptBefore.set(line._id, before + available);
    }
  }
  for (const [key, line] of Object.entries(next)) {
    const count = line.sharedStock ? sharedCount.get(line._id) : undefined;
    if (count !== undefined && line.stock !== count) next[key] = { ...line, stock: count };
  }
  return { cart: next, changed };
}

/**
 * Client F30: the bag without the lines checkout said it no longer sells
 * (by checkout price id), and the names it took out, for the one-tap
 * "Remove from bag". A line checkout did not name stays as it is.
 */
export function withoutUnavailableLines(cart: Cart, priceIds: readonly string[]): { cart: Cart; removed: string[] } {
  const gone = new Set(priceIds);
  const next: Cart = {};
  const removed: string[] = [];
  for (const [key, line] of Object.entries(cart)) {
    if (gone.has(line.priceID)) removed.push(line.name);
    else next[key] = line;
  }
  return { cart: next, removed };
}

/**
 * F526 seasonal (release C; `design-seasonal-products.md` 6.4, T12): the bag's
 * lines the total counts. A line checkout refused as no longer sold (out of
 * season, or taken off the site) stays in the bag, marked, until the shopper
 * removes it, but the total leaves it out at once, so the bag never shows a
 * total, or meets a minimum, with an item nobody can buy.
 */
export function linesCounted<T extends { priceID?: string }>(items: readonly T[], refusedPriceIds: readonly string[]): T[] {
  if (refusedPriceIds.length === 0) return [...items];
  const refused = new Set(refusedPriceIds);
  return items.filter((item) => !(item.priceID && refused.has(item.priceID)));
}

/** The line under the subtotal naming what it leaves out, or null when it leaves out nothing. */
export function withoutRefusedLine(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return "Without " + names[0] + ", which is no longer available.";
  const listed = names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
  return "Without " + listed + ", which are no longer available.";
}

/** The bag's one-tap button for lines checkout no longer sells. */
export const REMOVE_UNAVAILABLE_LABEL = "Remove from bag";

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
