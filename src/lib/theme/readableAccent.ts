/**
 * src/lib/theme/readableAccent.ts
 *
 * WCAG-AA readable variant of the brand accent for TEXT-ON-LIGHT surfaces —
 * the value emitted as the `--accent-readable` CSS var (layout.tsx SSR +
 * Providers client effect). The renderer's `styles/content-grid.css` consumes
 * it for rich-text links (`.vr-rich a`), falling back to `--primary` when a
 * consumer doesn't emit it.
 *
 * Deliberate SMALL LOCAL DUPLICATE of `readableAccentOnWhite` from
 * `@hillbombcreations/site-renderer/src/lib/contrast.ts` (the package exposes
 * no server-lean lib subpath; house convention accepts per-file duplicates —
 * see the usePosterOnly precedent). Keep the math in sync with the renderer.
 */

/** Parse `#rgb` / `#rrggbb` to [r,g,b] in [0,1]. Returns null on garbage. */
function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function srgbRelativeLuminance(v: number): number {
  const c = Math.min(1, Math.max(0, v));
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function colorLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * srgbRelativeLuminance(r) +
    0.7152 * srgbRelativeLuminance(g) +
    0.0722 * srgbRelativeLuminance(b)
  );
}

function wcagContrast(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Return the accent itself when it already reads AA (≥4.5:1) as text on white,
 * else a hue-preserving darkened variant that does; near-black as a last
 * resort. Non-hex input (CSS vars, rgb()) → null: the caller simply doesn't
 * emit the var and the CSS falls back to `--primary`.
 */
export function readableAccentOnWhite(accent: string | undefined): string | null {
  const rgb = accent ? parseHex(accent) : null;
  if (!rgb) return null;
  let [r, g, b] = rgb;
  for (let i = 0; i < 12; i += 1) {
    if (wcagContrast(1, colorLuminance(r, g, b)) >= 4.5) return toHex(r, g, b);
    r *= 0.85;
    g *= 0.85;
    b *= 0.85;
  }
  return '#111111';
}

/** WCAG AA for normal-size text. */
const AA_NORMAL = 4.5;

/**
 * The ink to put on an accent-filled button, ONLY when the caller's own ink
 * fails WCAG AA on it; `undefined` means "keep yours".
 *
 * Exists for the item page's action button (V7 F-D1), which copies the
 * renderer detail hero's rule (`var(--text-inverse, #ffffff)` on the accent)
 * and must not quietly ship a light accent with white ink. Unmeasurable input
 * (a CSS var, `rgb()`) answers `undefined`: nothing can be shown to fail.
 *
 * The replacement is the renderer's `readableBandInk` rule (`lib/contrast.js`,
 * 1.88.2, not exported from the package root): the softer `#111111` when it
 * clears AA, else whichever pure end clears, which always succeeds (the worst
 * case of the better of pure white and pure black is 4.58).
 */
export function inkOnAccentIfFailsAA(accent: string | undefined, ink: string | undefined): string | undefined {
  const bg = accent ? parseHex(accent) : null;
  const fg = parseHex(ink ?? '#ffffff');
  if (!bg || !fg) return undefined;
  const bgL = colorLuminance(bg[0], bg[1], bg[2]);
  if (wcagContrast(colorLuminance(fg[0], fg[1], fg[2]), bgL) >= AA_NORMAL) return undefined;
  // A grey's luminance is its one channel's (the three weights sum to 1).
  const soft = srgbRelativeLuminance(0x11 / 255);
  if (wcagContrast(soft, bgL) >= AA_NORMAL) return '#111111';
  return wcagContrast(1, bgL) >= wcagContrast(0, bgL) ? '#ffffff' : '#000000';
}
