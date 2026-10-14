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
 * WHY THE BASE SHEET IS CONDITIONAL. It is a render-blocking cross-origin
 * request, and a site only draws a literal family in three cases:
 *   - no display font: the `:root` default in globals.css is Outfit, then Inter;
 *   - a Studio typography preset, which names its families literally (the
 *     Providers effect writes them to `--font-display` / `--font-body`);
 *   - a display or body font that resolves to a literal family, for example
 *     `fontFamilyBody: 'Inter'` (Comedy Collective, Blackbird Hall).
 * A site on a self-hosted face (Geist on vivreal.io and help) or an uncurated
 * family (Cabin) draws none of them, so it gets no base sheet. Its fallback
 * chain still names a literal family after the head, but the head always
 * resolves (next/font, or its own sheet with `display=swap`).
 *
 * WHY PER-SITE SHEETS ARE FILTERED. Renderer 1.87.0 gives a curated family
 * named by its literal name its own `googleFontsHref`, `siteFontsHref(['Inter'])`.
 * Every such site also gets the base sheet (third case above), so that href is
 * dropped as covered. An uncurated family keeps its own sheet. Duplicates
 * collapse, so a display and body family on one sheet link once.
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

/** The part of a `resolveSiteFont` result this module reads. */
export type ResolvedSiteFont = { cssValue: string; googleFontsHref?: string } | null | undefined;

export type SiteFontsInUse = {
  /** `resolveSiteFont(siteData.fontFamily)`. Null means the globals.css Outfit default. */
  display: ResolvedSiteFont;
  /** `resolveSiteFont(siteData.fontFamilyBody)`, only resolved when `display` is set. */
  body?: ResolvedSiteFont;
  /** True when the site carries a Studio typography preset with a family in it. */
  typographyPreset?: boolean;
};

/** The first family in a `font-family` value, unquoted. `var(...)` heads come back as-is. */
function leadingFamily(cssValue: string): string {
  return cssValue.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

export function siteFontStylesheets(fonts: SiteFontsInUse, literal: LiteralFontSheets): string[] {
  const literalFamilies = new Set(literal.families);
  const drawsLiteralFamily =
    !fonts.display ||
    fonts.typographyPreset === true ||
    [fonts.display, fonts.body].some((font) => !!font && literalFamilies.has(leadingFamily(font.cssValue)));

  const coveredByBase = new Set(literal.families.map((family) => literal.sheetFor([family])));
  const hrefs = drawsLiteralFamily ? [literal.sheetFor()] : [];
  for (const font of [fonts.display, fonts.body]) {
    const href = font?.googleFontsHref;
    if (!href || hrefs.includes(href)) continue;
    // Only skip a covered href when the base sheet is actually linked.
    if (drawsLiteralFamily && coveredByBase.has(href)) continue;
    hrefs.push(href);
  }
  return hrefs;
}
