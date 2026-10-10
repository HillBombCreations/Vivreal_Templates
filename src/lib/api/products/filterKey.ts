/**
 * The product field a Product Filter narrows by (its `key`).
 *
 * Order, and why each step:
 *   1. The stored top-level `key`: every seeded filter and every filter saved
 *      through the portal's Manage Filters dialog carries one
 *      (`ecommerce.manifest.js` `productType`/`price`; the dialog refuses to
 *      save without it). It wins, so no live filter changes.
 *   2. `_system.key` (F-C16R, renderer `systemValue`): where the CMS keeps a
 *      SYSTEM value now that `key` is no longer a field of the type.
 *   3. The filter's own title, trimmed, case kept. A filter an owner adds in
 *      the plain list editor has no key at all, and products refer to a field
 *      by the name it was created with (the portal stores an owner's field
 *      under its trimmed, typed name, `collections/create/route.ts:128-132`).
 *      The shop matches `objectValue.<key>` exactly and case-sensitively
 *      (VR_Client_API `getCollectionObjects.js`), so the title is used as typed,
 *      never lower-cased or slugged.
 *
 * Pure, so it runs under `node --test`.
 */
import { systemValue } from '@hillbombcreations/site-renderer/bindings';

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export function filterKey(objectValue: Record<string, unknown>): string {
  return text(systemValue(objectValue, 'key')) ?? text(objectValue.title) ?? '';
}
