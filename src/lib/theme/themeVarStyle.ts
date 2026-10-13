import type { CSSProperties } from 'react';
// Explicit `.ts`: this module also loads under `node --test` (themeVarStyle.test.ts).
import { readableAccentOnWhite } from './readableAccent.ts';

/**
 * Theme tokens SSR'd onto `<html>` so the FIRST paint — including route-level
 * `loading.tsx` skeletons — is palette-correct. Without this, the tokens only
 * arrive via the client-side Providers effect, so a dark-theme site (e.g.
 * surface #0a0a0a) flashed a WHITE skeleton on every hard navigation.
 * Whitelisted to the siteDetails theme schema's color tokens — NOT every
 * string key on siteData (favicon is a multi-KB data URI; name/domain are not
 * CSS values). The Providers effect remains the post-hydration authority and
 * sets the same custom properties, so the two never disagree.
 *
 * Plus the three Call and Directions button tokens (W25-6ca, renderer 1.85.3:
 * `--contact-button-radius`, `-case`, `-tracking`, read before `--button-*`
 * and the 1.85.2 pill). Only these three: the general `button-radius`,
 * `-case` and `-tracking` keys would move about 20 other surfaces that read
 * `--button-radius`, and are not part of this release. A site without the
 * keys emits none, so its style is unchanged. The per-kit values are a data
 * step.
 *
 * Plus `font-mono` (C2, Larkspur, 2026-10-13): the renderer's eyebrow and
 * index labels read `var(--font-mono, ...)`. Unset on the server, the first
 * paint falls to Tailwind's own `--font-mono` (the system monospace) until the
 * Providers effect stamps the site's value. A site without the key emits none.
 *
 * Moved here from `src/app/layout.tsx` so the plain-Node runner can call it
 * (the layout is JSX); behaviour is unchanged for every existing key.
 */
export const THEME_TOKEN_KEYS = [
  'primary',
  'secondary',
  'hover',
  'surface',
  'surface-alt',
  'text-primary',
  'text-secondary',
  'text-inverse',
  'contact-button-radius',
  'contact-button-case',
  'contact-button-tracking',
  'font-mono',
] as const;

export function themeVarStyle(siteData: Record<string, unknown>): CSSProperties | undefined {
  const style: Record<string, string> = {};
  for (const key of THEME_TOKEN_KEYS) {
    const v = siteData[key];
    if (typeof v === 'string' && v.trim() !== '') style[`--${key}`] = v;
  }
  // Derived token — the AA-on-white variant of the brand accent, consumed by
  // the renderer's rich-text link rule (`.vr-rich a`) and any accent-as-text
  // surface. Only emitted for parseable hex primaries; the CSS falls back to
  // `--primary` otherwise (byte-identical for non-hex/absent primaries).
  const readable = readableAccentOnWhite(style['--primary']);
  if (readable) style['--accent-readable'] = readable;

  // `text-secondary` is commonly left unauthored (optional in the theme schema).
  // Leaving it unset here means every consuming component falls through to ITS
  // OWN hardcoded fallback (`var(--text-secondary, #555)`, `#64748b`, `#6b7280`,
  // ...) — all fixed mid-grays that go illegible on a dark/saturated brand
  // surface (the "navy blue text on dark red" defect, 2026-07). Setting an
  // actual `--text-secondary` here wins the CSS cascade over every component's
  // per-call fallback, so derive one muted TOWARD the site's own surface instead
  // of leaving the gap for a dozen different generic grays to fill in.
  if (!style['--text-secondary']) {
    const textPrimary = style['--text-primary'] ?? '#1c1c1c';
    const surface = style['--surface'] ?? '#ffffff';
    style['--text-secondary'] = `color-mix(in oklab, ${textPrimary} 55%, ${surface})`;
  }

  return Object.keys(style).length > 0 ? (style as CSSProperties) : undefined;
}
