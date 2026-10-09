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
 * and "Not enough stock available", both a 409. The other 409 there is "not
 * purchasable", which is not about stock and keeps the generic sentence.
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
 * What the shopper is told when checkout will not start.
 *
 * Deliberately OUR words. The upstream refusal prose names payment companies
 * and internal group ids ("No active Stripe integration found for this group"),
 * and this string is rendered straight into the cart, so echoing it would put
 * the wrong company's name and our internal vocabulary in front of a customer.
 * The upstream text is only READ, to tell a stock refusal apart. Every branch
 * says what to DO, because a cart that only says no is a dead button.
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
