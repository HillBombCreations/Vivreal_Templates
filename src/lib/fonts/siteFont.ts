/**
 * Per-site font theming — resolves a migrated site's captured display font
 * (`siteData.fontFamily`, e.g. `'Geist'`) to the CSS needed to render it,
 * consumed by the root layout to set the renderer's `--font-display` /
 * `--font-body` CSS variables (see `src/styles/globals.css`).
 *
 * WHAT THIS FILE IS NOW (renderer >= 1.66.0, preview-parity Wave 4, audit D1)
 * ---------------------------------------------------------------------------
 * The DECISION — the curated table, the normalization, the fallback chains,
 * the arbitrary-family branch, the Google Fonts URL, the cascade order — moved
 * into the renderer as `resolveSiteFont`. It is pure string work and it now has
 * exactly one implementation, shared with the Studio preview.
 *
 * That is the whole point of the wave. Before it there were three copies: this
 * file (live), `Vivreal_Portal_Mobile/src/lib/sites/previewSiteFont.ts` (Wave
 * 1's hand port), and the renderer's own fallback constants. The port shipped
 * with a cross-repo test that read THIS file off disk, because there was
 * nowhere else to put the shared truth. There is now.
 *
 * What stays here, and why it cannot move: `next/font/google` and
 * `next/font/local` are analysed statically by Next's SWC font loader at build
 * time, `next` is only a peer dependency of the renderer, and the className
 * each call returns is HASHED per build. So the renderer returns the custom
 * property NAME and this file maps that property to its own className, in one
 * table, below.
 *
 * FLEET-SAFETY (unchanged): `resolveSiteFont(undefined | null | '')` returns
 * `null`. Callers MUST skip all font wiring (no className, no inline style, no
 * <link>) when this returns `null` — that is what keeps every site without a
 * captured font rendering byte-identical to today's hardcoded Outfit default
 * (globals.css `:root { --font-display: 'Outfit', 'Inter', sans-serif; }`).
 *
 * A migrated site captures ONE primary typeface used site-wide (see
 * Vivreal_Site_Migrator's `capture/brand.js#normalizeFontFamily` — the crawler
 * doesn't distinguish a separate headings/body pairing), so the resolved value
 * is applied to BOTH --font-display and --font-body.
 *
 * Loading strategy (why only two families get a next/font call):
 *   - Outfit, Inter, Fraunces, Space Grotesk, Playfair Display, DM Sans, and
 *     Sora are ALREADY fetched for EVERY site, unconditionally, via the
 *     Google Fonts CSS2 `@import` at the top of `src/styles/globals.css` (the
 *     existing Studio "Branding -> Typography preset" system depends on those
 *     LITERAL family names being registered that way). Loading them again via
 *     next/font would double the network cost per site AND register a second,
 *     HASHED family name that a literal `'Fraunces', ...` CSS value could
 *     never select (see Vivreal_Portal_Mobile's
 *     `src/app/(studio-frame)/layout.tsx` for the same constraint documented
 *     against the preview shell). Mapping those seven to their existing
 *     literal names costs nothing extra and can't regress the preset system.
 *   - Geist is the one common family NOT already in that @import, so it is
 *     the one entry that genuinely needs a next/font/google load (self-hosted,
 *     optimized, `font-display: swap`) — no new npm dependency (Next.js 16
 *     bundles "Geist" in its Google Fonts metadata; see
 *     node_modules/next/dist/compiled/@next/font/dist/google/font-data.json).
 *   - Inter Display is NOT on Google Fonts at all, so it is vendored (OFL,
 *     official rsms/inter release) under ./inter-display/ and loaded via
 *     next/font/local — see the `interDisplayFont` declaration below.
 *
 * Full generality: a captured family outside the curated set falls through to
 * a best-effort runtime Google Fonts `<link>` (literal name) — see
 * `googleFontsHref` on the renderer's resolution. If Google Fonts doesn't have
 * that exact family, the `<link>` 404s/no-ops and the CSS fallback stack
 * (system sans-serif) applies; nothing throws.
 */
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';
import { resolveSiteFont as resolveSharedSiteFont } from '@hillbombcreations/site-renderer';

// next/font/google calls must be static module-scope calls (build-time
// analyzed) — this is the ONE curated family that isn't already loaded
// elsewhere in Templates (see file header). `variable` registers a CSS custom
// property (applied via `geistFont.variable` as a className) that resolves to
// next/font's self-hosted, hashed `@font-face` family — referenced by the
// renderer's resolution via `var(--font-geist)`.
const geistFont = Geist({
  subsets: ['latin'],
  weight: 'variable',
  variable: '--font-geist',
  display: 'swap',
});

// Inter Display — Inter's display-optical-size cut (tighter metrics than
// Inter; a site captured as 'Inter Display' wraps measurably differently if
// rendered with plain Inter). NOT on Google Fonts, so it is vendored from the
// official rsms/inter v4.1 release (`web/` unhinted woff2 set, SIL OFL 1.1 —
// see ./inter-display/OFL-LICENSE.txt) and self-hosted via next/font/local.
// Weights 400/500/600/700 cover every weight the renderer's typography tokens
// use; other weights synthesize from the nearest loaded face.
const interDisplayFont = localFont({
  src: [
    { path: './inter-display/InterDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: './inter-display/InterDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: './inter-display/InterDisplay-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './inter-display/InterDisplay-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter-display',
  display: 'swap',
});

/**
 * The CSS custom properties THIS app defines, and the next/font className that
 * defines each one.
 *
 * This is the whole reason the shared resolver takes an option rather than
 * hardcoding a `var()` head per family. A `var()` head is only correct for a
 * surface that actually defines the property: an unresolvable `var()`
 * invalidates the entire `font-family` declaration at computed-value time and
 * the element INHERITS. Inside the Studio preview that means the portal's own
 * Inter, which is exactly the bug D1 describes. The studio frame therefore
 * passes a DIFFERENT list (`--font-outfit`, `--font-geist`) to the same
 * function.
 *
 * Keep the keys and `TEMPLATES_FONT_VARIABLES` in step: the property list is
 * what the resolver is told, and the className map is what the layout applies.
 */
const FONT_VARIABLE_CLASSNAMES: Record<string, string> = {
  '--font-geist': geistFont.variable,
  '--font-inter-display': interDisplayFont.variable,
};

/**
 * The properties passed to the shared resolver. Declared as its own exported
 * constant so `siteFont.test.ts` can read it and pin the byte-for-byte output
 * of `resolveSiteFont(family, { definedFontVariables: TEMPLATES_FONT_VARIABLES })`
 * against the strings this site serves today.
 */
export const TEMPLATES_FONT_VARIABLES: readonly string[] = ['--font-geist', '--font-inter-display'];

export type SiteFontResolution = {
  /** CSS `font-family` value to assign to BOTH --font-display and --font-body. */
  cssValue: string;
  /** next/font `variable` class to apply on <html> (Geist / Inter Display only). */
  variableClassName?: string;
  /** Best-effort Google Fonts CSS2 stylesheet href for a non-curated family. */
  googleFontsHref?: string;
};

/**
 * Resolve `siteData.fontFamily` to the CSS/asset wiring needed to render it.
 *
 * A thin adapter over the renderer's `resolveSiteFont`: it supplies the
 * properties this app defines and turns the property the resolver chose back
 * into the hashed next/font className only this app knows.
 *
 * @param fontFamily - `siteData.fontFamily`, the migrator's normalized capture
 *   (e.g. `'Geist'`), an explicit Studio-authored value, or absent.
 * @param fontWeights - `siteData.fontWeights`, the weights the site declares
 *   (Storefront Phase 0.7). Absent requests the renderer's default weights.
 * @returns `null` when there is nothing to override (absent/blank input) —
 *   callers must render NO font wiring at all in that case (see file header).
 */
export function resolveSiteFont(fontFamily?: string | null, fontWeights?: unknown): SiteFontResolution | null {
  const resolved = resolveSharedSiteFont(fontFamily, {
    definedFontVariables: TEMPLATES_FONT_VARIABLES,
    fontWeights,
  });
  if (!resolved) return null;

  const variableClassName = resolved.fontVariable
    ? FONT_VARIABLE_CLASSNAMES[resolved.fontVariable]
    : undefined;

  return {
    cssValue: resolved.cssValue,
    ...(variableClassName ? { variableClassName } : {}),
    ...(resolved.googleFontsHref ? { googleFontsHref: resolved.googleFontsHref } : {}),
  };
}
