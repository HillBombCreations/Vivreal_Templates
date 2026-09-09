/**
 * "This item is not here", told apart from "the read that would have found it
 * never happened", for the detail route.
 *
 * WHY THIS EXISTS
 * ...............
 * The sibling of the generic-page defect fixed in `../api/composition/
 * pageEmptiness.ts`, one route over, and worse in the way that matters most.
 *
 * `clientFetchCached` swallows every upstream failure and hands back the
 * caller's fallback, so `getCollectionItems`, the products read, the shows read
 * and the team read all resolve to an empty list when VR_Client_API wobbles
 * (see `../api/degradedRead.ts` for why no inspection of the value can tell
 * that apart from a collection that really is empty). Every arm of
 * `app/[slug]/[itemId]/page.tsx` then asks "is the item in this list?", gets
 * `undefined`, and answers `redirectOrNotFound()`.
 *
 * The generic-page version of this could only swap the body under a 200,
 * because its guard runs inside a page-authored Suspense boundary. This route
 * has no such boundary: `DynamicItemPage` awaits every read before it returns
 * any JSX, which is exactly why `assertUpstreamHealthy()` can already set a
 * status from the top of it. So the 404 here is a REAL 404 on a real,
 * published detail item, and a crawler is told the item is gone rather than
 * shown a page that looks empty.
 *
 * That same property is what makes it cheaper to fix correctly. A refusal here
 * throws out of an un-suspended server component, which Next turns into a 5xx.
 * A 503 says come back; a 404 says drop this. The generic-page fix wanted that
 * outcome and could not have it.
 *
 * THE ORDER IS THE WHOLE DECISION, AND IT IS NOT THE OBVIOUS ONE
 * .............................................................
 * The item in hand settles it, BEFORE the degraded flags are consulted.
 *
 * Finding the item is positive proof that the read which produced it happened:
 * a degraded read always resolves to the empty sentinel, so it can never yield
 * an item. Checking the flags first looks safer and is not, and the generic-page
 * fix shipped that mistake in its first cut. A detail URL is routinely resolved
 * against MORE THAN ONE pool: a menu page searches its items binding and then
 * every sibling binding, and a non-`products` page carrying a storefront reads
 * the products list first and falls through to its collection arm on a miss.
 * When one of those reads fails and a later one finds the item, the page has
 * the item in hand and rendered fine before this change. Refusing it would turn
 * a partial wobble into a hard error on a page that demonstrably exists, and it
 * would get MORE likely the more pools a page carries, which is backwards.
 *
 * Note this is not the mirror of the defect. The defect read "not in the list"
 * as evidence of absence, which is exactly what a failed read produces. This
 * reads "in the list" as evidence of a successful read, which a failed read
 * cannot produce. One direction is sound and the other is not.
 *
 * WHY A PLAIN `.ts` MODULE WITH NO `server-only` AND NO NEXT IMPORT
 * ................................................................
 * Same reason as `./canonical.ts`, `./detailFormats.ts` and
 * `../api/composition/pageEmptiness.ts`: `node --experimental-strip-types
 * --test` can drive it directly, and the route that consumes it is a `.tsx`
 * file full of JSX that no plain-Node test can execute. Every claim above is
 * exercised in `./detailItemMiss.test.ts`.
 */

/**
 * One read whose pool could have contained the addressed item, reduced to the
 * only thing the verdict needs from it.
 */
export interface DetailItemRead {
  /**
   * Which pool this was. Diagnostics only, never part of the verdict: it makes
   * a failing test name the arm rather than an index, and it documents at each
   * call site which reads are being accounted for.
   */
  readonly source: string;
  /** See `../api/degradedRead.ts`. An empty list is the same value either way. */
  readonly degraded: boolean;
}

/**
 * What an unresolved detail URL means, once "not there" and "not knowable" are
 * separated.
 *
 * `isMissing` and `existenceUnknown` are mutually exclusive by construction.
 * That is the whole correction: they used to be the same absent value.
 */
export interface ItemExistenceVerdict {
  /**
   * The item genuinely is not addressable here, ON DATA THAT WAS ACTUALLY
   * READ. This is the state `redirectOrNotFound()` exists for, and it still
   * resolves an authored redirect or 404s.
   */
  readonly isMissing: boolean;
  /**
   * At least one read that could have produced this item did not happen, so
   * whether the item exists is not knowable and the caller must refuse rather
   * than answer.
   *
   * The refusal replaces the REDIRECT as well as the 404, deliberately. A 308
   * is the more durable claim of the two: it tells a crawler this URL has moved
   * permanently. Issuing one because a read failed would be the same mistake in
   * a louder form, and the authored redirect still resolves correctly on the
   * next request that gets an answer.
   */
  readonly existenceUnknown: boolean;
}

/**
 * Decide whether a detail URL addresses nothing, and whether we are entitled to
 * say so.
 *
 * `found` is the item the route resolved (any truthy item, or `undefined` /
 * `null` on a miss). `reads` is every read whose pool could have contained it,
 * accumulated across the arms the request actually ran.
 */
export function decideDetailItemMiss(args: {
  found: unknown;
  reads: readonly DetailItemRead[];
}): ItemExistenceVerdict {
  // The item in hand settles it. See the module docblock: this ordering is the
  // decision, not a tidy-up, and reversing it refuses pages that render today.
  if (args.found) return { isMissing: false, existenceUnknown: false };

  // Nothing matched anywhere. Now, and only now, does it matter whether that is
  // an answer or a silence.
  if (args.reads.some((read) => read.degraded)) {
    return { isMissing: false, existenceUnknown: true };
  }

  return { isMissing: true, existenceUnknown: false };
}

/**
 * The `reads` a caller has accumulated so far, as a list it can append to.
 *
 * The detail route resolves an item across arms that return early, so the flags
 * cannot be gathered in one place: the products read runs before the collection
 * arm and its result has to survive into it. This is a plain array rather than
 * anything cleverer so that the accumulation is visible at every call site.
 */
export type DetailItemReads = DetailItemRead[];
