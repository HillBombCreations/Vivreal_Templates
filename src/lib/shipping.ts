/**
 * Does this business ship orders?
 *
 * `businessInfo.shipping` is an OPTIONAL boolean, so it has three states and
 * only two of them are obvious. This module exists to answer the third one
 * once, by name, in a place a grep can find.
 *
 * THE DECISION: UNSET MEANS NO SHIPPING. This is a choice, not a fallback.
 *
 * Vivreal's customers are overwhelmingly local service businesses, salons,
 * bakers, trades. Most of them never ship anything, so an unset flag on those
 * accounts is not a missing value, it is simply the truth. Defaulting the other
 * way would put an address step in front of the majority of checkouts in order
 * to protect a minority case.
 *
 * The residual risk is real and was accepted with open eyes: a physical-goods
 * seller who never set the flag can take an order with no shipping address.
 * That is RECOVERABLE, because the owner has the buyer's contact details and
 * can follow up. An unnecessary address wall is NOT recoverable, because the
 * visitor just leaves.
 *
 * WHY A HELPER AND NOT AN EXPRESSION. Before this file there were SEVEN inline
 * readings of the same optional boolean across four different semantics, and
 * four of them decided the same `requiresShipping` wire field in two opposed
 * camps: `!!shipping` in the cart dialog and the floating cart, `shipping !==
 * false` in Buy Now and the renderer's cart adapter. On a site with the flag
 * unset, Buy Now collected a shipping address and Proceed to Checkout did not,
 * on the same product, in the same session.
 *
 * None of the seven had a NAME, which is why a search for the rule found
 * nothing and the drift went unnoticed. `VR_Main_API` hit the identical shape
 * this same wave with a seat rule reimplemented inline in four places. Two call
 * sites that have to stay in step are a bug waiting for a deadline, so the rule
 * gets a name and exactly one definition.
 */

/** The only part of `businessInfo` any shipping question reads. */
export interface ShippingBusinessInfo {
  shipping?: boolean;
}

/**
 * True when the business ships orders, and so when checkout must collect a
 * shipping address.
 *
 * Unset is FALSE, deliberately. See the decision above before changing it, and
 * change it here rather than at a call site.
 */
export function shipsOrders(
  businessInfo: ShippingBusinessInfo | null | undefined,
): boolean {
  return !!businessInfo?.shipping;
}

/**
 * True only when the owner has EXPLICITLY declared that they do not ship.
 *
 * Deliberately NOT the inverse of {@link shipsOrders}, and the difference is
 * the whole reason both exist.
 *
 * `shipsOrders` answers a question the site has to answer whether the owner
 * filled the field in or not: collect an address, or do not. Silence is a
 * usable answer there.
 *
 * This one backs an affirmative marketing CLAIM, the "Pickup only, shipping is
 * not available" badge on the products page. A baker who never opened that
 * setting has not asked us to advertise "Pickup only" on their storefront, and
 * inferring it from silence would put that badge on the majority of sites in
 * the fleet overnight. An owner has to say it for us to print it.
 */
export function declaresPickupOnly(
  businessInfo: ShippingBusinessInfo | null | undefined,
): boolean {
  return businessInfo?.shipping === false;
}
