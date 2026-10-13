/**
 * The Google Fonts stylesheets the root layout links, in order.
 *
 * WHY THE BASE SHEET IS A <link> (C1, 2026-10-13). The literal families
 * (Inter, Outfit, Fraunces, Space Grotesk, Playfair Display, DM Sans, Sora)
 * used to load from a Google Fonts `@import url(...)` at the top of
 * `src/styles/globals.css`. That line never reached a live site:
 * `next build --turbopack` drops an external `@import url()` from the CSS chunk
 * it emits (measured on halo-blow-dry-bar.vivreal.io and vivreal.io, and on a
 * local build of `fae616d`, where `next build --webpack` on the same tree keeps
 * it). Every site therefore drew those families in the system fallback. The
 * base sheet now comes from the renderer's `siteFontsHref()`, the same family
 * list and weight specs the Studio preview loads, so the two surfaces agree.
 *
 * WHY PER-SITE SHEETS ARE FILTERED. Renderer 1.87.0 gives a curated family
 * named by its literal name (`fontFamily: 'Inter'`) its own `googleFontsHref`,
 * `siteFontsHref(['Inter'])`. Here that would be a second request for a face
 * the base sheet already registers, so any href the base sheet covers is
 * dropped. An uncurated family (Cabin, Cinzel) keeps its own sheet. Duplicates
 * collapse, so a display and body family that resolve to one sheet link once.
 *
 * The renderer functions are passed in rather than imported: the package
 * barrel pulls `next/link`, which plain Node cannot resolve, and this module is
 * exercised by `node --test` (see `siteFontStylesheets.test.ts`).
 */
export type LiteralFontSheets = {
  /** The renderer's `siteFontsHref`. Called with no argument it covers every literal family. */
  sheetFor: (families?: readonly string[]) => string;
  /** The renderer's `SITE_FONT_LITERAL_FAMILIES`. */
  families: readonly string[];
};

export function siteFontStylesheets(
  perSiteHrefs: ReadonlyArray<string | undefined>,
  literal: LiteralFontSheets,
): string[] {
  const base = literal.sheetFor();
  const coveredByBase = new Set(literal.families.map((family) => literal.sheetFor([family])));
  const hrefs = [base];
  for (const href of perSiteHrefs) {
    if (!href || coveredByBase.has(href) || hrefs.includes(href)) continue;
    hrefs.push(href);
  }
  return hrefs;
}
