/**
 * What `/api/checkout` sends VR_Client_API and what it tells the shopper when
 * checkout will not start. Pure and free of `next/server`, so it runs under
 * `node --test`; the route is the thin call site.
 */

/** The `reason` the route adds when checkout refused a line for stock. */
export const CHECKOUT_OUT_OF_STOCK = "out_of_stock";

/**
 * VR_Client_API's two stock refusals (`createCheckoutSession.js`, the
 * `content.checkout.session.out_of_stock` branch): "This item is out of stock"
 * and "Not enough stock available", both a 409. A 409 `not_for_sale` has its
 * own sentences (below); any other 409 keeps the generic sentence.
 */
const STOCK_REFUSAL = /\bout of stock\b|\bnot enough stock\b/i;

/** One line checkout named as short: its checkout price id and how many are left. */
export interface ShortStockLine {
  priceId: string;
  available: number;
}

export interface CheckoutRefusal {
  error: string;
  reason?: typeof CHECKOUT_OUT_OF_STOCK;
  /** Present only when VR_Client_API named the short lines (Client #117 and later). */
  items?: ShortStockLine[];
}

/**
 * Client #117's over-stock 409 names the short lines:
 * `{ errorCode: 'INSUFFICIENT_STOCK', items: [{ priceId, available }] }`.
 * Read at the boundary: a malformed entry is dropped, and no valid entry at all
 * means `undefined`, so the bag falls back to the stock it stored.
 */
function readShortStockLines(body: unknown): ShortStockLine[] | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { errorCode, items } = body as { errorCode?: unknown; items?: unknown };
  if (errorCode !== "INSUFFICIENT_STOCK" || !Array.isArray(items)) return undefined;
  const lines = items.flatMap((entry): ShortStockLine[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { priceId, available } = entry as { priceId?: unknown; available?: unknown };
    if (typeof priceId !== "string" || !priceId || typeof available !== "number" || !Number.isInteger(available) || available < 0) {
      return [];
    }
    return [{ priceId, available }];
  });
  return lines.length > 0 ? lines : undefined;
}

const isInsufficientStock = (body: unknown) =>
  typeof body === "object" && body !== null && (body as { errorCode?: unknown }).errorCode === "INSUFFICIENT_STOCK";

/**
 * VR_Client_API's 409 `not_for_sale` sentences (`listCommerce.js`), written
 * for a shopper and marked `ownerSafe`. Only these exact strings are shown;
 * any other text on a `not_for_sale` reads as the paused-list sentence, so an
 * upstream wording change can never put unreviewed prose in the bag.
 */
const SHOP_NOT_READY = "This shop is not taking orders yet.";
const ITEM_NOT_FOR_SALE = "This item is not for sale right now. Take it out of your bag, then check out the rest.";
const OWNER_SAFE_NOT_FOR_SALE: ReadonlySet<string> = new Set([
  ITEM_NOT_FOR_SALE,
  "This item is not available right now. The shop has been told.",
  SHOP_NOT_READY,
]);

/**
 * FP2-06 and FP2-02: the sentence for a 409 `not_for_sale`, or `undefined` when
 * the body is not one. `reason: 'not_ready'` (the shop's payment account cannot
 * take orders) wins over the text. Never "refresh": refreshing cannot help.
 */
function notForSaleSentence(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const { errorCode, reason, ownerSafe, error } = body as {
    errorCode?: unknown;
    reason?: unknown;
    ownerSafe?: unknown;
    error?: unknown;
  };
  if (errorCode !== "not_for_sale") return undefined;
  if (reason === "not_ready") return SHOP_NOT_READY;
  if (ownerSafe === true && typeof error === "string" && OWNER_SAFE_NOT_FOR_SALE.has(error)) return error;
  return ITEM_NOT_FOR_SALE;
}

/**
 * What the shopper is told when checkout will not start.
 *
 * Deliberately OUR words. The upstream refusal prose names payment companies
 * and internal group ids ("No active Stripe integration found for this group"),
 * and this string is rendered straight into the cart, so echoing it would put
 * the wrong company's name and our internal vocabulary in front of a customer.
 * The upstream text is only READ, to tell a stock refusal apart, except a
 * `not_for_sale` sentence on the closed list above, which VR_Client_API wrote
 * for shoppers. Every other branch says what to DO, because a cart that only
 * says no is a dead button.
 */
export function checkoutRefusal(status: number, upstreamError: unknown, upstreamBody?: unknown): CheckoutRefusal {
  const stockByText = typeof upstreamError === "string" && STOCK_REFUSAL.test(upstreamError);
  if (status === 409 && (stockByText || isInsufficientStock(upstreamBody))) {
    // The bag replaces this with the exact lines and counts it can name.
    const items = readShortStockLines(upstreamBody);
    return {
      error: "Some of your bag has sold out since you added it. Lower the amount, then try again.",
      reason: CHECKOUT_OUT_OF_STOCK,
      ...(items ? { items } : {}),
    };
  }
  const notForSale = status === 409 ? notForSaleSentence(upstreamBody) : undefined;
  if (notForSale) return { error: notForSale };
  if (status === 404 || status === 409 || status === 422) {
    return { error: "Something in your bag is no longer available. Refresh the page, then try again." };
  }
  if (status === 429) {
    return { error: "Checkout is busy right now. Wait a moment, then try again." };
  }
  if (status >= 500) {
    return { error: "We could not start checkout just now. Please try again in a moment." };
  }
  return { error: "We could not start checkout. Refresh the page, then try again." };
}

const SITE_ID_SHAPE = /^[0-9a-fA-F]{24}$/;

/**
 * QA-W2-4: this deployment's site id for checkout branding, or `undefined`.
 *
 * VR_Client_API names the checkout's business, logo and colour from the site
 * (`resolveCheckoutSite`, rung 1 is `siteId`); without it, the only other rung
 * is the origin host, which refuses http, any port and every Amplify host, so
 * those checkouts showed the payment account's own name. Its validator is
 * `Joi.string().hex().length(24).optional()`, so anything else (the local
 * `preview` value, an unset env) is LEFT OUT rather than sent, because a
 * malformed id would refuse the whole checkout with a 400.
 */
export function checkoutSiteId(siteId: string | undefined | null): string | undefined {
  const trimmed = typeof siteId === "string" ? siteId.trim() : "";
  return SITE_ID_SHAPE.test(trimmed) ? trimmed : undefined;
}
