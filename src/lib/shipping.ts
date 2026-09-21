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

/**
 * What we can HONESTLY say about how this business gets goods to a customer.
 *
 * `null` means "say nothing", and it is the DEFAULT rather than a special case.
 * Read the `return null` at the bottom as the rule and the two branches above
 * it as the exceptions, not the other way round: any state that is not an
 * explicit, owner-supplied answer falls through to silence, so a field that
 * gains a third value later is safe here without anyone remembering to come
 * back.
 *
 * WHY THIS IS NOT JUST `shipsOrders()` INVERTED. `brand/voice.md` sets an
 * honesty floor: verify a claim before asserting it. `shipsOrders()` returns a
 * boolean because checkout has to DO something either way, and silence is a
 * usable answer to "collect an address". A badge is different. It is an
 * assertion to a visitor, and the two states are not exhaustive:
 *
 *   shipping === true   the owner told us they ship        -> we can say so
 *   shipping === false  the owner told us they do not      -> we can say so
 *   unset               the owner has told us NOTHING      -> we say nothing
 *
 * The tempting move on unset is "they sell goods and do not ship, so pickup
 * must be the option". That reasoning holds for a shop and fails for exactly
 * the businesses this default was chosen for: a salon or a trade sells no
 * physical goods at all, so "Pickup available" is not a safer guess than "Fast
 * delivery", it is a different unverified one. Swapping a claim we know is
 * false for a claim we merely suspect is true does not clear the honesty floor.
 */
export type FulfilmentClaim = "ships" | "pickup" | null;

export function verifiableFulfilmentClaim(
  businessInfo: ShippingBusinessInfo | null | undefined,
): FulfilmentClaim {
  // STRICTLY `=== true`, where `shipsOrders()` is deliberately a `!!`. The two
  // differ because they answer to different standards, and the difference is
  // not fussiness: the field is typed `boolean` but arrives from the CMS over
  // the wire, so the type is a statement of intent rather than a runtime
  // guarantee. `!!` is right for checkout, which has to pick a behaviour for
  // whatever shows up. It is wrong for an assertion to a visitor, because
  // truthiness is not recognition: `1` and, worst of all, the STRING "false"
  // are both truthy, and either would have printed "Fast delivery" on a site
  // that ships nothing. A claim needs a value we actually recognise.
  //
  // This was not reasoned out in advance. The "silence is the default" test
  // below fed the function values it was never written for, and `{shipping: 1}`
  // came back claiming delivery.
  if (businessInfo?.shipping === true) return "ships";
  if (declaresPickupOnly(businessInfo)) return "pickup";
  return null;
}
