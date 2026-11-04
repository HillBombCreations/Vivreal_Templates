/**
 * What `/api/checkout` sends VR_Client_API and what it tells the shopper when
 * checkout will not start. Pure and free of `next/server`, so it runs under
 * `node --test`; the route is the thin call site.
 */
import { NO_WAY_TO_GET_ORDER } from "./cart/cartSettings.ts";

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

/** The `reason` the route adds when one of the shop's own rules refused checkout. */
export const CHECKOUT_SHOP_RULE = "shop_rule";

/**
 * VR_Client_API's shop rules (owner ideas 3.9, 3.10, `shopRules.js`), each a
 * 409 the cart answers by staying open with everything kept. The words are
 * this app's, keyed on the stable code, never the upstream sentence. F54
 * (VR_Client_API #135) added the delivery codes, each in the server's own
 * words (`shopRules.js` `deliveryWords`, `PRICE_MISSING_WORDS`,
 * `PICKUP_NOT_OFFERED_WORDS`): a ZIP nobody could check is never told "we do
 * not deliver there". These are the words for a shop that offers pickup; a
 * cart without Pickup shows `SHOP_RULE_SENTENCES_NO_PICKUP` instead (below),
 * so no refusal suggests a pickup the shop does not offer, and OUT_OF_AREA
 * matches the Client's no-pickup words (#135 `93490e54`, `deliveryWords`).
 * `{zip}` is the ZIP this checkout sent.
 */
export const SHOP_RULE_SENTENCES: Readonly<Record<string, string>> = Object.freeze({
  BELOW_MINIMUM: "Your order is below the shop's minimum. Add a little more, then try again.",
  BELOW_DELIVERY_MINIMUM: "Your order is below the minimum for delivery. Add a little more, or choose pickup.",
  OUT_OF_AREA: "We do not deliver to {zip} yet.",
  ZIP_NOT_RECOGNIZED: "We could not check {zip}. Send us your address and we will let you know right away.",
  DELIVERY_ORIGIN_MISSING: "We cannot check delivery just yet. Send us your address and we will let you know right away.",
  DELIVERY_PRICE_MISSING: "Delivery is not available online yet. Contact the shop to arrange it.",
  PICKUP_NOT_OFFERED: "This shop does not offer pickup.",
  PICKUP_UNAVAILABLE: "This pickup time is no longer available. Pick another.",
  // Review note 1 on #226: the shop offers no way to get the order; one sentence, the one the cart shows.
  NO_WAY_TO_GET_ORDER,
});

/**
 * The same rules' words for a cart where Pickup is not offered (the owner's
 * "Offer pickup" is off, or the cart quote says `pickupOffered: false`).
 * BELOW_DELIVERY_MINIMUM drops its pickup suggestion and keeps the rest word
 * for word. OUT_OF_AREA is the Client's no-pickup sentence, the same words the
 * cart quote line shows. The pickup-only rules answer a pickup, so they never
 * reach a cart without one. `{zip}` is filled by the same rule as above.
 */
const SHOP_RULE_SENTENCES_NO_PICKUP: Readonly<Record<string, string>> = Object.freeze({
  BELOW_DELIVERY_MINIMUM: "Your order is below the minimum for delivery. Add a little more.",
  OUT_OF_AREA: "We do not deliver to {zip} yet. Send us a note and we will see what we can do.",
});

const ZIP_SHAPE = /^\d{5}$/;

/** `{zip}` filled with a five digit ZIP, or "that ZIP" for anything else. */
function fillZip(sentence: string, zip: string | undefined): string {
  return sentence.replace("{zip}", typeof zip === "string" && ZIP_SHAPE.test(zip) ? zip : "that ZIP");
}

/**
 * The words the cart shows for a shop-rule refusal, by whether this cart
 * offers Pickup. `zip` is the ZIP the cart sent.
 */
export function shopRuleWords(code: string | undefined, message: string, pickupOffered: boolean, zip?: string): string {
  if (pickupOffered || typeof code !== "string" || !Object.hasOwn(SHOP_RULE_SENTENCES_NO_PICKUP, code)) return message;
  return fillZip(SHOP_RULE_SENTENCES_NO_PICKUP[code], zip);
}

export interface CheckoutRefusal {
  error: string;
  reason?: typeof CHECKOUT_OUT_OF_STOCK | typeof CHECKOUT_SHOP_RULE;
  /** The shop rule's code, only with `reason: shop_rule`, and only a key of `SHOP_RULE_SENTENCES`. */
  code?: string;
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
 *
 * W1 (D11): "This item is not available right now. The shop has been told." is
 * OFF the list. It promised something nobody could keep; VR_Client_API (C1)
 * now answers an item Stripe refused with `ITEM_NOT_FOR_SALE`, and an older
 * build still sending the retired sentence reads as that same sentence here.
 */
const SHOP_NOT_READY = "This shop is not taking orders yet.";
const ITEM_NOT_FOR_SALE = "This item is not for sale right now. Take it out of your bag, then check out the rest.";
const OWNER_SAFE_NOT_FOR_SALE: ReadonlySet<string> = new Set([ITEM_NOT_FOR_SALE, SHOP_NOT_READY]);

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
export function checkoutRefusal(status: number, upstreamError: unknown, upstreamBody?: unknown, zip?: string): CheckoutRefusal {
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
  const ruleCode =
    status === 409 && typeof upstreamBody === "object" && upstreamBody !== null
      ? String((upstreamBody as { errorCode?: unknown }).errorCode)
      : "";
  // Own keys only: a code like "constructor" must not resolve through the prototype.
  const shopRule = Object.hasOwn(SHOP_RULE_SENTENCES, ruleCode) ? SHOP_RULE_SENTENCES[ruleCode] : undefined;
  if (shopRule) {
    // Only a well-formed ZIP is echoed back; anything else reads "that ZIP".
    // `code` is one of this file's own keys, so the cart can pick its no-pickup words.
    return { error: fillZip(shopRule, zip), reason: CHECKOUT_SHOP_RULE, code: ruleCode };
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
