/**
 * Whether the checkout success page may tell the shopper their order is
 * confirmed (TB-5, re-walk B, 2026-10-08).
 *
 * The success card ("Order confirmed! Thank you for your purchase...") is the
 * renderer's CheckoutResultTemplate, and it rendered for ANY visit to the
 * success page, including a made-up `?session_id=` link. The cart was already
 * kept for such a link (`confirmedOrderCart.ts`, RW5), but the page still
 * congratulated the visitor on an order that does not exist.
 *
 * The card now shows only after the SAME server check the cart-clearing uses:
 * the id is posted to `/api/checkout/confirm` once per page (`confirmOrder.ts`,
 * shared, so this adds no request), and it is confirmed only when
 * VR_Client_API read the order from the merchant's own Stripe or Square account
 * and found it paid.
 *
 * Everything else splits in two (final pass, 2026-10-08), because a paying
 * buyer can land unconfirmed: a Square return link without an order id, a
 * confirm call that failed or timed out, a store whose provider is not
 * supported yet. Telling that buyer "we could not find that order" is false.
 *   - `unverified`, nobody could check: thanks, and if you paid, the shop has
 *     your order and a receipt is coming.
 *   - `no-paid-order`, VR_Client_API positively answered that this store has
 *     no such order: a neutral line. An order that exists but is not paid yet
 *     (still processing, approved but not captured) is `unverified`, as is a
 *     configuration fault (orderConfirmationId.ts says why).
 * Both link back to the shop and keep the cart. Nothing about the order is
 * shown unless it was confirmed.
 */
import { isOrderConfirmationId, type OrderCheck } from "./orderConfirmationId.ts";
import { isPageTurnedOff, type SwitchablePage } from "./pages/pageEnabled.ts";

export type OrderConfirmationStatus = "checking" | OrderCheck;

export const ORDER_CHECKING_COPY = "Checking your order.";
export const ORDER_UNVERIFIED_HEADING = "Thanks for your order.";
export const ORDER_UNVERIFIED_BODY =
  "We could not show the confirmation here, but if you paid, the shop has your order and you will get a receipt by email.";
export const NO_PAID_ORDER_HEADING = "We could not find a paid order for this link.";
export const NO_PAID_ORDER_BODY = "If you paid, check your email for a receipt.";
export const BACK_TO_SHOP_COPY = "Back to the shop";

/** What each settled, unconfirmed status says. */
export const UNCONFIRMED_COPY: Readonly<Record<Exclude<OrderCheck, "confirmed">, { heading: string; body: string }>> =
  Object.freeze({
    unverified: { heading: ORDER_UNVERIFIED_HEADING, body: ORDER_UNVERIFIED_BODY },
    "no-paid-order": { heading: NO_PAID_ORDER_HEADING, body: NO_PAID_ORDER_BODY },
  });

/**
 * How long the page waits on the check before saying it could not be done.
 * The upstream Square read alone may take 5 s (VR_Client_API
 * SQUARE_READ_TIMEOUT_MS), so this leaves room for that plus the mail queue.
 */
export const ORDER_CHECK_TIMEOUT_MS = 10_000;

/** A check still running at the timeout is unverified; a settled one stands. */
export function statusAfterTimeout(current: OrderConfirmationStatus): OrderConfirmationStatus {
  return current === "checking" ? "unverified" : current;
}

/**
 * Resolves to "confirmed" only when the server confirms the order on the URL.
 * A malformed or missing id is never posted, and is unverified: a Square buyer
 * whose return link carried no id has still paid.
 */
export async function resolveOrderConfirmation({
  search,
  confirm,
}: {
  search: string;
  confirm: (orderId: string) => Promise<OrderCheck>;
}): Promise<OrderCheck> {
  const orderId = new URLSearchParams(search).get("session_id");
  if (!isOrderConfirmationId(orderId)) return "unverified";
  try {
    return await confirm(orderId);
  } catch {
    // confirmOrder never rejects today; if an injected confirm ever does,
    // nobody checked, so the answer is "unverified", never the card.
    return "unverified";
  }
}

/** Structural so the node test runner can load this without tsconfig paths. */
export type ShopPage = SwitchablePage & { slug?: string };

/**
 * Where "Back to the shop" goes: the page the renderer's `findShopPage` picks,
 * else the home page. The caller passes `findShopPage(siteData.pageConfigs)`
 * (`app/[slug]/page.tsx`), so checkout and the Link page's "Your shop" button
 * share one rule (F48, qa walk 2026-11-02). The old rule here knew only a
 * Products page, so a shop built as a Catalog page (Cobalt & Crumb's /shop)
 * sent the buyer home. The renderer is not imported here because its barrel
 * cannot load under `node --test`; the test composes the two the same way.
 */
export function shopHrefFrom(shop: ShopPage | undefined | null): string {
  if (!shop || isPageTurnedOff(shop) || typeof shop.slug !== "string" || shop.slug.length === 0) return "/";
  return `/${shop.slug}`;
}
