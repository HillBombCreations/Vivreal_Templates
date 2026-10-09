/**
 * F4 (storefront task T2, SF2): the bag prices its lines from a live server
 * quote, so it shows the sale and never shows less than checkout charges.
 *
 * WHY A QUOTE AND NOT A STORED SALE PRICE. Re-walk R3 measured a bag at $6.00
 * whose checkout charged $4.50: the bag read the CMS display price and knew
 * nothing of the sale. Storing the sale on the bag line would be worse, because
 * a sale that ends while the bag is open would leave the bag showing LESS than
 * the charge. VR_Client_API's `POST /tenant/cartQuote` prices the lines with the
 * same function checkout uses (release plan contract C6), and the bag shows that.
 *
 * CONTRACT C6 (verbatim shape): request `{ cartLineItems: [{ price, quantity }] }`,
 * response `{ lines: [{ priceId, unitCents, saleUnitCents, saleName }] }`, per
 * unit, integer cents. A line no product carries, or Stripe cannot price, is
 * left out and the bag shows its list price. `saleUnitCents` and `saleName` are
 * `null` when no sale takes money off; `saleUnitCents: 0` is a real sale priced
 * at zero.
 *
 * THE PROMO CODE (review-3 BLOCK 5). Checkout gives each line the larger of its
 * sale and the code, never both. `validateCoupon`'s `newSubtotal` is the LIST
 * subtotal less the code on the lines the code wins. So the bag's code discount
 * is `couponPreviewDiscount(newSubtotal, quotedSubtotal)`, which makes the total
 * `min(quotedSubtotal, newSubtotal)`. Checkout charges at most each of the two,
 * so the bag can never show less than the charge. Subtracting the list based
 * preview from the quoted subtotal would stack the code on the sale: a $10 item
 * on a 10% sale with a 20% code would show $7.00 while checkout charges $8.00.
 *
 * Pure, so it runs under `node --experimental-strip-types --test`.
 */
import { cartUnitPrice, type PricedLine } from './cartPrice.ts';
import { couponPreviewDiscount } from './couponPreview.ts';

export interface CartQuoteLine {
  priceId: string;
  unitCents: number;
  saleUnitCents: number | null;
  saleName: string | null;
}

/** Quoted lines by price id. A price id absent here shows its list price. */
export type CartQuote = ReadonlyMap<string, CartQuoteLine>;

export const SALE_ENDED_COPY = 'A sale just ended. Prices are updated.';

const isCents = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

function parseLine(raw: unknown): CartQuoteLine | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { priceId, unitCents, saleUnitCents, saleName } = raw as Record<string, unknown>;
  if (typeof priceId !== 'string' || priceId.length === 0 || !isCents(unitCents)) return null;
  // A sale price above the price is not a sale; showing it would raise the bag.
  if (saleUnitCents !== null && !(isCents(saleUnitCents) && saleUnitCents <= unitCents)) return null;
  if (saleName !== null && typeof saleName !== 'string') return null;
  return {
    priceId,
    unitCents,
    saleUnitCents,
    // A name is only shown beside a sale; an empty one is no name.
    saleName: saleUnitCents !== null && typeof saleName === 'string' && saleName.trim() ? saleName.trim() : null,
  };
}

/**
 * Read the quote at the boundary. `null` means the quote failed, and the bag
 * shows list prices. A malformed line is dropped, so that line shows its list
 * price, which is never below the charge.
 */
export function parseCartQuote(raw: unknown): CartQuote | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const lines = (raw as { lines?: unknown }).lines;
  if (!Array.isArray(lines)) return null;
  const byPrice = new Map<string, CartQuoteLine>();
  for (const entry of lines) {
    const line = parseLine(entry);
    if (line) byPrice.set(line.priceId, line);
  }
  return byPrice;
}

export type QuotableItem = PricedLine & { priceID?: string; quantity?: number | null };

export interface LinePrice {
  /** What one unit costs, in dollars: the sale price when a sale applies. */
  unit: number;
  /** The struck original, in dollars, only when a sale takes money off. */
  was: number | null;
  saleName: string | null;
}

/** One bag line's price: quoted when the quote carries it, else today's list price. */
export function linePrice(item: QuotableItem, quote: CartQuote | null): LinePrice {
  const quoted = item.priceID ? quote?.get(item.priceID) : undefined;
  if (!quoted) return { unit: cartUnitPrice(item), was: null, saleName: null };
  if (quoted.saleUnitCents === null) return { unit: quoted.unitCents / 100, was: null, saleName: null };
  return { unit: quoted.saleUnitCents / 100, was: quoted.unitCents / 100, saleName: quoted.saleName };
}

const quantityOf = (item: QuotableItem) =>
  typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;

/** The bag subtotal in dollars, summed in whole cents so a sum never drifts. */
export function quotedSubtotal(items: readonly QuotableItem[], quote: CartQuote | null): number {
  const cents = items.reduce(
    (acc, item) => acc + Math.round(linePrice(item, quote).unit * 100) * quantityOf(item),
    0,
  );
  return cents / 100;
}

export interface BagTotals {
  subtotal: number;
  discount: number;
  total: number;
}

/**
 * Subtotal, code discount and total. `codeNewSubtotalCents` is the applied
 * code's `newSubtotal` from `validateCoupon`, or `null` with no code applied.
 */
export function bagTotals(
  items: readonly QuotableItem[],
  quote: CartQuote | null,
  codeNewSubtotalCents: number | null,
): BagTotals {
  const subtotal = quotedSubtotal(items, quote);
  const discount = codeNewSubtotalCents === null ? 0 : couponPreviewDiscount(codeNewSubtotalCents, subtotal);
  return { subtotal, discount, total: Math.max(0, Math.round((subtotal - discount) * 100) / 100) };
}

const effectiveCents = (line: CartQuoteLine) => line.saleUnitCents ?? line.unitCents;

/**
 * Did any price the bag was showing go UP? Only lines both quotes carry are
 * compared: a price the shopper never saw quoted cannot have "ended", and a
 * failed quote is not a sale ending.
 */
export function quoteRaisedAPrice(shown: CartQuote | null, next: CartQuote | null): boolean {
  if (!shown || !next) return false;
  for (const [priceId, before] of shown) {
    const after = next.get(priceId);
    if (after && effectiveCents(after) > effectiveCents(before)) return true;
  }
  return false;
}

export interface CartQuoteRequestLine {
  price: string;
  quantity: number;
}

/** The request body's lines, validated (the same shape `validateCoupon` takes). */
export function isCartQuoteRequestLine(item: unknown): item is CartQuoteRequestLine {
  if (typeof item !== 'object' || item === null) return false;
  const { price, quantity } = item as Record<string, unknown>;
  return (
    typeof price === 'string' &&
    price.length > 0 &&
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity > 0
  );
}
