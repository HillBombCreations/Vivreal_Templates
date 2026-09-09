/**
 * "This read did not happen", told apart from "this read came back empty".
 *
 * WHY THIS EXISTS
 * ...............
 * `clientFetchCached` and `clientFetchSafe` swallow every upstream failure by
 * design and hand back the caller's `fallback` (see the capture at the swallow
 * in `./client.ts`). That is the right posture for a page that should still
 * render its chrome. It is the wrong posture for any caller that then draws a
 * CONCLUSION from what came back, because at the moment the fallback is
 * returned the difference between "the collection is empty" and "the collection
 * could not be read" has already been destroyed.
 *
 * The concrete cost of that lost difference: a generic page's `isEmpty` check
 * read `items.length === 0` and answered `notFound()`. A transient VR_Client_API
 * wobble therefore took a real, published page off the site and told the crawler
 * it was gone. Same shape as the degraded SITE-data path fixed alongside this
 * (`./siteData/degraded.ts`), one layer down and on data that is otherwise
 * completely healthy, so the guard up there never sees it.
 *
 * WHY REFERENCE IDENTITY, AND WHY THAT IS NOT A TRICK
 * ..................................................
 * A failed read is invisible in the VALUE: `{ items: [], totalCount: 0 }` is
 * exactly what a genuinely empty collection returns, byte for byte, and no
 * inspection of the payload can ever tell the two apart. That is the whole
 * defect, so a fix that inspects the payload would only relocate it.
 *
 * What CAN tell them apart is provenance. `clientFetchCached` returns the very
 * object it was handed when, and only when, it swallowed a failure; a successful
 * read returns a freshly parsed body. So "I got back the exact object I passed
 * in" is a sound and complete test for "the read did not happen", and it is the
 * same reasoning `./siteData/degraded.ts` gives for preferring an explicit
 * marker over an inference: only the fallback path can produce it, so it can
 * never be true of data that was actually read.
 *
 * The sentinel is built per call, so no two reads can share one and one read
 * failing can never mark another. It is also frozen, though `Object.freeze` is
 * SHALLOW and `sentinel.items` stays a mutable array: that freeze is a guard
 * against a caller reusing the envelope, not a proof of anything. The identity
 * check is what carries the correctness, and identity survives mutation anyway.
 *
 * A 402 is NOT a degraded read. Both fetch helpers re-throw it so the page can
 * render `QuotaExceeded`, which means it never reaches this comparison, and a
 * quota-exceeded site keeps behaving exactly as it did.
 *
 * KNOWN LIMIT, RECORDED RATHER THAN GUESSED AT
 * ............................................
 * This tells "did not answer" apart from "answered empty". It does NOT tell a
 * TRANSIENT failure apart from a TERMINAL one, because `clientFetchCached`
 * swallows a 404 and a 503 identically and `ApiError.status` is gone one line
 * before this function could read it. So a collection that has genuinely been
 * deleted, if the upstream answers 404 for it rather than an empty list, reads
 * as degraded forever, and a page bound to it refuses permanently where it used
 * to 404 permanently. Neither answer is good; a permanent 5xx is at least loud,
 * and a deleted binding is a data-repair problem either way.
 *
 * The real fix is one layer up, and it is the same shape as this whole defect:
 * `clientFetchCached` should hand back `{ value, degraded, status }` and let the
 * callers that do not care discard it, rather than making the callers that DO
 * care reconstruct it. That would delete this module. Deliberately not attempted
 * in the same change as the 404 it exists to stop, because it touches every read
 * in the app.
 *
 * A second, narrower hole is left open for the same reason: `doClientFetch`
 * returns `envelope.data` verbatim, so a SUCCESSFUL response carrying
 * `data: null` resolves to `undefined`, which is not the sentinel, and the
 * caller still counts zero items. Pre-existing, unchanged here, and the same
 * status-aware fetch would close it.
 *
 * WHY A PLAIN `.ts` MODULE WITH NO `server-only` AND NO NEXT IMPORT
 * ................................................................
 * Same reason as `./clientFetchCore.ts`, `./collections/mapItem.ts` and
 * `./composition/pageEmptiness.ts`: `node --experimental-strip-types --test` can
 * drive it directly. The single most important claim here (a genuinely empty
 * upstream response must NOT read as degraded) is exercised in
 * `./composition/degradedCollectionRead.test.ts` rather than argued for in prose.
 */

/** A read's value, plus whether it actually happened. */
export interface ReadOutcome<T> {
  /** What to render with. The caller's own empty shape on a failed read. */
  readonly value: T;
  /**
   * True when the upstream failed and `value` is the placeholder. A caller that
   * is about to conclude something from `value` (that a page is missing, that a
   * catalogue is empty) MUST branch on this first.
   */
  readonly degraded: boolean;
}

/**
 * Run a swallowing fetch and report whether it swallowed.
 *
 * `emptyResult` is called once per invocation to build this read's private
 * sentinel, which is then handed to `read` as its fallback. Pass a FACTORY, not
 * a shared constant: two reads sharing one sentinel would be indistinguishable
 * from each other, and a frozen module-level constant handed to a caller that
 * stores it would be a cross-request hazard for no benefit.
 *
 * @example
 *   const { value, degraded } = await readOrDegrade(
 *     () => ({ items: [], totalCount: 0 }),
 *     (fallback) => clientFetchCached(path, fallback, ttl, undefined, tags),
 *   );
 */
export async function readOrDegrade<T extends object>(
  emptyResult: () => T,
  read: (fallback: T) => Promise<T>,
): Promise<ReadOutcome<T>> {
  const sentinel = Object.freeze(emptyResult());
  const value = await read(sentinel);
  return { value, degraded: Object.is(value, sentinel) };
}
