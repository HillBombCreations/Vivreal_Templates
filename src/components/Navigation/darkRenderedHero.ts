/**
 * The `renderedHero` a page passes to the Navbar shell (owner find 3,
 * renderer 1.92.0): `renderedHeroFor(input)` on a Mood dark site, nothing
 * anywhere else.
 *
 * Why the Mood gate is here and not only in the renderer: `resolveMastheadTone`
 * ignores `renderedHero` off a Dark site, but `renderedHeroFor` runs the whole
 * composition pipeline a second time beside `composePage`, so a non-Dark site
 * must not pay for it, and must not carry the prop (its header stays
 * byte-identical). The second run is safe where it is called: the input comes
 * from `buildPageContext`, whose `getItems` and `getIntegrationItems` are sync
 * reads of maps fetched once, and the pipeline does not write to its input
 * (both pinned in `darkRenderedHero.test.ts`).
 *
 * The renderer function is passed in, not imported: the package's main entry
 * pulls `next/link`, which plain Node cannot load, and the test needs to see
 * whether it was called.
 */
/**
 * The stored hero variants whose page-top answer can depend on collection
 * reads. Derived from the renderer (1.92.0), not chosen: the hero's only
 * collection reads are `resolveFeatureItem` and `resolveFeatureItemEmpty`
 * (`dist/composition/resolveHero.js`), both gated on
 * `hero.variant === 'feature-item'`. The hero block's partners binding also
 * reads a collection, but `heroTakesSiteDark` never reads partners, so it
 * cannot move the answer. `darkRenderedHero.test.ts` proves the set exact by
 * running every variant the renderer names with an empty and a filled
 * collection: the answer moves for exactly these variants.
 */
export const COLLECTION_READING_HERO_VARIANTS: readonly string[] = ['feature-item'];

/**
 * Owner find 3, orchestrator decision for `[slug]` routes: their header
 * renders above the Suspense boundary, before the page's collection reads.
 * Only a Mood dark page whose stored hero reads collections waits for those
 * reads above the boundary, so its header can be given `renderedHero`. Every
 * other page streams exactly as before, with no extra await. A header that
 * streams in late was rejected (layout shift).
 */
export function needsHeroInputAbove(
  chrome: unknown,
  page: { hero?: unknown } | null | undefined,
): boolean {
  const hero = page?.hero;
  // Templates' PageHero type does not declare `variant`; the stored hero carries it, so read it as data.
  const variant = hero && typeof hero === 'object' ? (hero as { variant?: unknown }).variant : undefined;
  return chrome === 'dark' && typeof variant === 'string' && COLLECTION_READING_HERO_VARIANTS.includes(variant);
}

export function darkRenderedHero<Input, Hero>(
  chrome: unknown,
  input: Input,
  heroFor: (input: Input) => Hero | null,
): Hero | null {
  return chrome === 'dark' ? heroFor(input) : null;
}
