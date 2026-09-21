/**
 * Cart line-price arithmetic.
 *
 * H34: the bag used to read its prices with a bare `Number(item.price)`. The
 * storefront `price` field is a DISPLAY STRING authored in the CMS, so a
 * perfectly ordinary "$24.99" coerced to `NaN`, the `|| 0` beside it floored
 * that to zero, and the shopper was shown a Subtotal of $0.00 while checkout
 * charged the real amount server-side. The coupon preview then subtracted
 * server cents from the same broken number.
 *
 * `parseCartPrice` is a deliberate LOCAL MIRROR of the renderer's `parsePrice`
 * (`@hillbombcreations/site-renderer`, `lib/sale.ts`), the same pattern as the
 * local provider set in `lib/payments.ts` and the storefront config resolver in
 * `lib/storefront/storefrontConfig.ts`. It is mirrored rather than imported
 * because the renderer's package exports map publishes only the barrel, and the
 * barrel pulls `next/link`, which the plain-Node test runner cannot resolve.
 * `cartPrice.parity.test.ts` runs BOTH implementations over one table so any
 * drift fails the suite rather than splitting the price the card shows from the
 * price the bag totals.
 *
 * Known shared limitation, stated rather than discovered: a comma is stripped,
 * not read as a decimal separator, so "1,299.00" is 1299 (right) and a European
 * "24,99" is 2499 (wrong). That is the renderer's behaviour too, and matching
 * it is the point. A card and a bag that disagree is worse than one both share.
 */

/** The fields of a bag line that price arithmetic actually reads. */
export interface PricedLine {
  price?: unknown;
  variant?: string | null;
  quantity?: number | null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Coerce a possibly-stringy price ("18", "18.00", "$18", "$1,299.00") to a
 * finite number of dollars, or undefined when there is no number in it at all.
 */
export function parseCartPrice(value: unknown): number | undefined {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string") {
    // Keep digits, the decimal point and a sign; drop currency symbols,
    // thousands separators, spaces and unit suffixes.
    const cleaned = value.replace(/[^0-9.-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * The unit price of one bag line, in dollars.
 *
 * Tolerates the legacy shape where `price` was persisted as a whole
 * variant-to-price map instead of the resolved string. A bag lives in
 * IndexedDB for 24 hours, so a line written by an older bundle can outlive the
 * deploy that fixed it.
 */
export function cartUnitPrice(item: PricedLine | null | undefined): number {
  if (!item) return 0;
  const raw =
    typeof item.price === "object" && item.price !== null && item.variant
      ? (item.price as Record<string, unknown>)[item.variant]
      : item.price;
  return parseCartPrice(raw) ?? 0;
}

/** The total for one bag line (unit price times quantity), in dollars. */
export function cartLineTotal(item: PricedLine | null | undefined): number {
  if (!item) return 0;
  const qty = isFiniteNumber(item.quantity) ? item.quantity : 0;
  return cartUnitPrice(item) * qty;
}

/** The bag subtotal, in dollars. */
export function cartSubtotal(items: ReadonlyArray<PricedLine>): number {
  return items.reduce((acc, item) => acc + cartLineTotal(item), 0);
}
