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
export function darkRenderedHero<Input, Hero>(
  chrome: unknown,
  input: Input,
  heroFor: (input: Input) => Hero | null,
): Hero | null {
  return chrome === 'dark' ? heroFor(input) : null;
}
