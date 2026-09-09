/**
 * Which variant a variant-priced product's structured data describes, and how
 * to read a `Variantable` field for it.
 *
 * WHY THIS EXISTS
 * ...............
 * `buildDetailJsonLd` only emits an `Offer` when it is handed a publishable
 * price, and the detail route only handed it `typeof product.price === 'string'`
 * values. A variant product's `price` is a MAP, so every one of them fell
 * through to `Thing` and shipped no price, no currency and no availability at
 * all. That is not a smaller version of the wrong-availability bug, it is a
 * bigger one: an empty `Thing` tells a search engine nothing about a product
 * that is for sale, and in this fleet every product that tracks stock is
 * variant-priced.
 *
 * WHY NOT AggregateOffer, WHICH IS THE OBVIOUS ANSWER
 * ...................................................
 * Because both the vocabulary and Google say not to, and they say it for the
 * same reason.
 *
 * schema.org defines `AggregateOffer` as what to use "when a single product is
 * associated with multiple offers (for example, the same pair of shoes is
 * offered by different merchants)". It aggregates SELLERS, not sizes. One
 * bakery selling a cookie by the piece and by the dozen is one seller.
 *
 * Google is more direct. Its Product structured data guidance says plainly:
 * "Don't use AggregateOffer to describe a set of product variants." And its
 * merchant listing guidance disqualifies the type outright: "Product snippets
 * accept an Offer or AggregateOffer but merchant listings require an Offer as
 * the merchant has to be the seller of the product in order to be eligible for
 * merchant listing experiences." So an AggregateOffer here would be both
 * semantically wrong and a downgrade in eligibility.
 *
 * `availability` would technically have been legal on it, since `AggregateOffer`
 * is a subtype of `Offer` and inherits the property. That is exactly the trap:
 * legal in the vocabulary, wrong in the guidance, and the thing being described
 * is not what the type means.
 *
 * WHY NOT ProductGroup / hasVariant, WHICH IS GOOGLE'S ACTUAL VARIANT ANSWER
 * .........................................................................
 * Because this route cannot satisfy its precondition. Google requires that
 * "the site must have the ability to preselect each variant directly with a
 * distinct URL (using URL query parameters)", plus a `sku` or `gtin` per
 * variant. Our detail route serves one URL per product and the variant is
 * chosen client-side in the buy box, so there is no per-variant URL to point a
 * `hasVariant` entry at. Marking up variants Google cannot address would be
 * asserting a structure the site does not have. Reachable later if the route
 * ever grows a `?variant=` parameter; not assertable today.
 *
 * WHAT IS EMITTED INSTEAD, AND WHY IT IS THE HONEST CLAIM
 * ......................................................
 * One ordinary `Offer`, describing THE VARIANT THE PAGE ACTUALLY RENDERS.
 *
 * That is not a compromise, it is the strictest reading of the rule this whole
 * change set is built on: the structured data must not contradict the page it
 * ships on. With nothing selected, the renderer resolves the active variant to
 * the first authored value (`resolveVariant`: `selectedVariant ?? values[0]`),
 * and BOTH the price in the hero and the enabled-or-disabled state of the
 * button in `DetailAddToCart` are computed for that variant. So the variant the
 * server renders is a fact, not a choice, and an `Offer` describing it says
 * exactly what a reader of that HTML sees.
 *
 * This also dissolves the mixed-availability question rather than answering it
 * badly. "Some variants in stock and some not" needs no aggregate verdict here,
 * because the document describes one variant and reports that variant's own
 * state. The alternative considered and rejected was a product-level aggregate
 * (`computeProductStockState`, which is what a product CARD uses): pairing an
 * aggregate `InStock` with the rendered variant's price is a pair that is not
 * jointly true the moment the rendered variant is the sold-out one, which is
 * the precise failure being fixed, reintroduced one level up.
 *
 * A range was considered too, and there is nowhere truthful to put one. `Offer`
 * has no low/high price; `lowPrice` and `highPrice` belong to `AggregateOffer`,
 * which is ruled out above.
 *
 * WHY A LOCAL COPY OF THE RENDERER'S RESOLUTION
 * ............................................
 * The renderer's `resolveVariant` and `resolveVariantableString` are internal:
 * its `package.json` `exports` map exposes only `.` and `./agent`, so
 * `@hillbombcreations/site-renderer/dist/lib/variant.js` is not importable by
 * that specifier at all (unlike `resolveStock`, which IS on the barrel and is
 * therefore used directly rather than copied).
 *
 * A copy of a function whose whole job is to agree with another function is a
 * drift hazard, and drift here means the claim and the button disagree, which is
 * the bug. So this is not left as a comment saying "keep these in step":
 * `productOffer.test.ts` imports the renderer's real implementation by RELATIVE
 * path (which bypasses the `exports` restriction) and asserts case by case that
 * this copy agrees with it. A renderer bump that changes the resolution fails
 * the suite instead of silently changing what the fleet claims.
 *
 * Same `node --test` reasoning as `./canonical.ts`, `./itemMiss.ts` and
 * `../api/composition/pageEmptiness.ts`: no `server-only`, no Next import.
 */

/** The `usingVariant` shape, as much of it as the offer needs. */
export interface OfferVariantConfig {
  readonly name?: string;
  readonly values?: readonly string[];
}

/**
 * The variant the page renders with nothing selected, or `null` for a product
 * that has no variants.
 *
 * Mirrors the renderer's `resolveVariant(null, product)`. Server-side there is
 * never a selection, so this is always the first authored value.
 */
export function offerVariantKey(usingVariant: OfferVariantConfig | undefined): string | null {
  if (usingVariant?.values?.length) return usingVariant.values[0] ?? null;
  return null;
}

/**
 * Read a `Variantable<string>` field for one variant.
 *
 * Mirrors the renderer's `resolveVariantableString`, including its two
 * fallbacks in order: an explicit `default` key, then the first key. Both exist
 * so a partially authored variant map still renders something rather than a
 * blank, and both have to be reproduced here or the JSON-LD would omit a field
 * the page is showing.
 *
 * `String(...)` matches upstream too: a price authored as the number 4 in a
 * variant map renders as "4", and must reach `asOfferPrice` as "4".
 */
function resolveVariantableString(value: unknown, variantKey: string | null): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const map = value as Record<string, unknown>;
    if (variantKey && variantKey in map) return String(map[variantKey]);
    if ('default' in map) return String(map['default']);
    const keys = Object.keys(map);
    return keys.length > 0 ? String(map[keys[0]]) : undefined;
  }
  return undefined;
}

/**
 * One field of the product, resolved exactly as the rendered page resolves it.
 *
 * Mirrors the renderer's `getSafeFieldValue`, including the guard that a
 * variant key not present in `usingVariant.values` is treated as no selection
 * at all rather than looked up.
 */
export function offerFieldValue(
  field: unknown,
  variantKey: string | null,
  variantValues: readonly string[] | undefined,
): string | undefined {
  if (field === undefined) return undefined;
  if (variantValues?.length && variantKey && !variantValues.includes(variantKey)) {
    return resolveVariantableString(field, null);
  }
  return resolveVariantableString(field, variantKey);
}
