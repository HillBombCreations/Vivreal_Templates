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
 * and found it paid. Everything else (no id, a malformed id, an unknown or
 * unpaid order, a failed request) gets a neutral line and a link back to the
 * shop. Nothing about the order is shown for an id that was not confirmed.
 */
import { isOrderConfirmationId } from "./orderConfirmationId.ts";
import { isPageTurnedOff, type SwitchablePage } from "./pages/pageEnabled.ts";

export type OrderConfirmationStatus = "checking" | "confirmed" | "unconfirmed";

export const ORDER_CHECKING_COPY = "Checking your order.";
export const ORDER_NOT_FOUND_HEADING = "We could not find that order.";
export const ORDER_NOT_FOUND_BODY = "If you paid, check your email for a receipt.";
export const BACK_TO_SHOP_COPY = "Back to the shop";

/**
 * Resolves to "confirmed" only when the server confirms the order on the URL.
 * A malformed or missing id is never posted.
 */
export async function resolveOrderConfirmation({
  search,
  confirm,
}: {
  search: string;
  confirm: (orderId: string) => Promise<boolean>;
}): Promise<Exclude<OrderConfirmationStatus, "checking">> {
  const orderId = new URLSearchParams(search).get("session_id");
  if (!isOrderConfirmationId(orderId)) return "unconfirmed";
  try {
    return (await confirm(orderId)) ? "confirmed" : "unconfirmed";
  } catch {
    // confirmOrder never rejects today; if an injected confirm ever does, the
    // honest answer is still "not confirmed", never the congratulations card.
    return "unconfirmed";
  }
}

/** Structural so the node test runner can load this without tsconfig paths. */
export type ShopPage = SwitchablePage & { slug?: string; format?: string };

/** The site's first switched-on products page, else the home page. */
export function shopHrefFor(pages: readonly ShopPage[] | undefined | null): string {
  const shop = (pages ?? []).find(
    (p) => p.format === "products" && typeof p.slug === "string" && p.slug.length > 0 && !isPageTurnedOff(p),
  );
  return shop ? `/${shop.slug}` : "/";
}
