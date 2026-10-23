/**
 * Provenance of a floor answer: "this value came from the build-time snapshot,
 * not from a live read".
 *
 * WHY REFERENCE IDENTITY. Same reasoning as `../degradedRead.ts`: a floor
 * answer is byte-for-byte what a live read of the same path returned at build
 * time, so nothing in the VALUE can tell the two apart. What can is where the
 * object came from. The floor hands out a fresh clone per call and marks that
 * clone here, so `isFloorValue` is true of exactly the objects the floor
 * produced (and the site data built from one, see `getSiteData`), and never of
 * anything a live read returned.
 *
 * Who needs to know: a caller about to make a NEGATIVE claim ("this page does
 * not exist", "this item is gone"). The floor is build-time data, so a page or
 * item created after the build is absent from it, and a 404 drawn from that
 * absence would tell a crawler a live URL is gone. Those callers refuse
 * instead (plan section 5.5, "Negative claims are never made from the floor").
 *
 * A `WeakSet`, so marking holds nothing alive. Plain module, no `server-only`.
 */
const FLOOR_VALUES = new WeakSet<object>();

/** Mark `value` as a floor answer and return it. Non-objects are returned unmarked. */
export function markFloorValue<T>(value: T): T {
  if (typeof value === 'object' && value !== null) FLOOR_VALUES.add(value);
  return value;
}

/** True only for an object `markFloorValue` marked. */
export function isFloorValue(value: unknown): boolean {
  return typeof value === 'object' && value !== null && FLOOR_VALUES.has(value);
}
