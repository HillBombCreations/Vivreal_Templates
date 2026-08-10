/**
 * Per-site font theming — resolves a migrated site's captured display font
 * (`siteData.fontFamily`, e.g. `'Geist'`) to the CSS needed to render it,
 * consumed by the root layout to set the renderer's `--font-display` /
 * `--font-body` CSS variables (see `src/styles/globals.css`).
 *
 * FLEET-SAFETY: `resolveSiteFont(undefined | null | '')` returns `null`.
 * Callers MUST skip all font wiring (no className, no inline style, no
 * <link>) when this returns `null` — that is what keeps every site without a
 * captured font rendering byte-identical to today's hardcoded Outfit default
 * (globals.css `:root { --font-display: 'Outfit', 'Inter', sans-serif; }`).
 *
 * A migrated site captures ONE primary typeface used site-wide (see
 * Vivreal_Site_Migrator's `capture/brand.js#normalizeFontFamily` — the crawler
 * doesn't distinguish a separate headings/body pairing), so the resolved value
 * is applied to BOTH --font-display and --font-body.
 *
 * Loading strategy (why only Geist uses next/font/google):
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
 * `googleFontsHref` below. If Google Fonts doesn't have that exact family, the
 * `<link>` 404s/no-ops and the CSS fallback stack (system sans-serif) applies;
 * nothing throws.
 */
import { Geist } from 'next/font/google';
import localFont from 'next/font/local';

// next/font/google calls must be static module-scope calls (build-time
// analyzed) — this is the ONE curated family that isn't already loaded
// elsewhere in Templates (see file header). `variable` registers a CSS custom
// property (applied via `geistFont.variable` as a className) that resolves to
// next/font's self-hosted, hashed `@font-face` family — referenced below via
// `var(--font-geist)`.
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

// Mirrors the renderer's typography.ts fallback stacks (src/tokens/typography.ts
// in @hillbombcreations/site-renderer) so a curated match's fallback behavior
// is consistent with the platform's other font presets.
const SANS_FALLBACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;
const SERIF_FALLBACK = `'Iowan Old Style', 'Apple Garamond', Georgia, serif`;

type CuratedFont = {
  /** CSS `font-family` value (literal name or a next/font `var(...)` reference + fallback). */
  value: string;
  /** next/font `variable` className to apply on <html> — only set for next/font-backed entries. */
  nextFontVariable?: string;
};

// Keyed by a normalized (lowercased, alphanumeric-only) family name so
// 'Space Grotesk', 'space-grotesk', and 'SpaceGrotesk' all resolve the same way.
const CURATED_FONTS: Record<string, CuratedFont> = {
  outfit: { value: `'Outfit', ${SANS_FALLBACK}` },
  inter: { value: `'Inter', ${SANS_FALLBACK}` },
  fraunces: { value: `'Fraunces', ${SERIF_FALLBACK}` },
  spacegrotesk: { value: `'Space Grotesk', ${SANS_FALLBACK}` },
  playfairdisplay: { value: `'Playfair Display', ${SERIF_FALLBACK}` },
  dmsans: { value: `'DM Sans', ${SANS_FALLBACK}` },
  sora: { value: `'Sora', ${SANS_FALLBACK}` },
  geist: { value: `var(--font-geist), 'Geist', ${SANS_FALLBACK}`, nextFontVariable: geistFont.variable },
  interdisplay: {
    value: `var(--font-inter-display), 'Inter Display', 'Inter', ${SANS_FALLBACK}`,
    nextFontVariable: interDisplayFont.variable,
  },
};

function normalizeKey(fontFamily: string): string {
  return fontFamily.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type SiteFontResolution = {
  /** CSS `font-family` value to assign to BOTH --font-display and --font-body. */
  cssValue: string;
  /** next/font `variable` class to apply on <html> (curated Geist entry only). */
  variableClassName?: string;
  /** Best-effort Google Fonts CSS2 stylesheet href for a non-curated family. */
  googleFontsHref?: string;
};

/**
 * Resolve `siteData.fontFamily` to the CSS/asset wiring needed to render it.
 *
 * @param fontFamily - `siteData.fontFamily`, the migrator's normalized capture
 *   (e.g. `'Geist'`), an explicit Studio-authored value, or absent.
 * @returns `null` when there is nothing to override (absent/blank input) —
 *   callers must render NO font wiring at all in that case (see file header).
 */
export function resolveSiteFont(fontFamily?: string | null): SiteFontResolution | null {
  if (!fontFamily || typeof fontFamily !== 'string') return null;
  const trimmed = fontFamily.trim();
  if (!trimmed) return null;

  const curated = CURATED_FONTS[normalizeKey(trimmed)];
  if (curated) {
    return { cssValue: curated.value, variableClassName: curated.nextFontVariable };
  }

  // Not in the curated set — best-effort arbitrary-family support. Strip quote/
  // backslash characters defensively before embedding the (migrator-captured,
  // third-party-sourced) family name into a CSS value and a URL.
  const safeName = trimmed.replace(/["'\\]/g, '');
  if (!safeName) return null;
  return {
    cssValue: `'${safeName}', ${SANS_FALLBACK}`,
    googleFontsHref: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(safeName).replace(/%20/g, '+')}&display=swap`,
  };
}
