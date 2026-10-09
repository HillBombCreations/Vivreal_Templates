/**
 * F2 (storefront task T1): the business wide "Show Only 3 left" switch, carried
 * from VR_Client_API's site details onto `siteData` for the renderer.
 *
 * Release plan contract C5: `showLowStock` is a boolean, and ABSENT means each
 * template's own default (the renderer's `lookShopRules`; Standard shows). So
 * absent has to stay absent here. Mapping it to `false` would hide "Only 3 left"
 * on every Standard shop that never touched the switch, and mapping `null` or a
 * stray string through would hand the renderer a value it does not expect.
 *
 * Returned as a spread so an absent value adds no key at all, rather than a key
 * holding `undefined`.
 *
 * NO `server-only` IMPORT, so this runs under `node --experimental-strip-types
 * --test` (the same split as `./chrome.ts` and `../richTextImageUrls.ts`).
 */
export function readShowLowStock(raw: unknown): { showLowStock?: boolean } {
  if (typeof raw !== 'object' || raw === null) return {};
  const value = (raw as { showLowStock?: unknown }).showLowStock;
  return typeof value === 'boolean' ? { showLowStock: value } : {};
}
