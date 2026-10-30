/**
 * The pure half of `queryReadGate.ts` (review B2): given Next's two work
 * stores, may this render read the address query? See that file for why.
 * Pure, so `node --test` decides it the way the route does.
 */
export function queryReadAllowed(
  unitStore: { type?: unknown } | undefined,
  workStore: { isBuildTimePrerendering?: unknown } | undefined,
): boolean {
  if (unitStore?.type === 'request') return true;
  return workStore?.isBuildTimePrerendering === true;
}
