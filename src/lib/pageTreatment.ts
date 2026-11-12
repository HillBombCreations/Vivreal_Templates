import type { CSSProperties } from 'react';
import type { PageConfig as RendererPageConfig, resolvePagePalette } from '@hillbombcreations/site-renderer';

/**
 * The style `composePage` puts on its page wrapper, for the title band this app
 * mounts OUTSIDE that wrapper (renderer #140 review, N1; renderer 1.98.5).
 *
 * WHY. A page's colour treatment ("Tinted", "Softer", "Flipped colors") and its
 * chosen page background live on `composePage`'s wrapper, and since 1.98.5 a
 * treatment that rebases the page surface also PAINTS it there. The Studio
 * draws the title band inside that wrapper (`options.titleBand`). This app
 * mounts the band in the streaming shell, above the Suspense boundary, so the
 * real heading is on screen before the collection reads land
 * (`renderComposedPage.tsx`). That put the band outside the treated area: on a
 * Tinted page the title sat on the plain site colour above a tinted page, and
 * on "Flipped colors" a light strip sat above a dark page, while the Studio
 * showed one treated page. The shell now wraps the band and the body in one
 * element carrying this style, so the whole page reads as one treatment, as it
 * does in the Studio.
 *
 * A HAND COPY of `composePage`'s wrapper style (`composePage.tsx`, the
 * `pageBgStyle`, `paletteVars`, `bgTextRescope`, `paletteSurface` and
 * `wrapperStyle` locals). `resolvePageBackground` and
 * `resolvePageBackgroundTextRescope` are not on the package's public entry, so
 * they are restated below. `pageTreatment.test.ts` holds the copy to the
 * renderer: the restated resolvers against the renderer's own, and the whole
 * style against the wrapper the installed `composePage` actually renders, over
 * every treatment and background. A renderer bump that changes the wrapper
 * turns that test red.
 *
 * `undefined` whenever `composePage`'s wrapper carries no style (no treatment,
 * no page background), so the shell adds no element and an untreated page is
 * byte-identical to before.
 *
 * The palette resolver is passed in, not imported: the package's main entry
 * pulls `next/link`, which plain Node cannot load (the `darkRenderedHero.ts`
 * precedent).
 */
export function pageTreatmentStyle(
  page: Pick<RendererPageConfig, 'palette' | 'background'>,
  site: SiteColourTokens,
  resolvePalette: typeof resolvePagePalette,
): CSSProperties | undefined {
  const pageBgStyle = pageBackground(page.background);
  const paletteVars = resolvePalette(page.palette, {
    primary: site.primary,
    secondary: site.secondary,
    hover: site.hover,
    surface: site.surface,
    'surface-alt': site['surface-alt'],
    'text-primary': site['text-primary'],
    'text-secondary': site['text-secondary'],
    'text-inverse': site['text-inverse'],
  });
  const bgTextRescope = pageBackgroundTextRescope(page.background);
  if (!paletteVars && !pageBgStyle && !bgTextRescope) return undefined;

  // 1.98.5 (W3-7): a treatment that rebases the page surface paints it; a
  // chosen page background is an explicit choice of what to paint and wins.
  const paletteSurface =
    paletteVars?.['--surface'] && !pageBgStyle
      ? { backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }
      : undefined;
  // Same order as the renderer: custom properties first, so a background on
  // the same element reads the rebased tokens.
  return {
    ...(paletteVars ?? {}),
    ...(bgTextRescope ?? {}),
    ...(pageBgStyle ? { backgroundColor: pageBgStyle } : {}),
    ...(paletteSurface ?? {}),
  } as CSSProperties; // CSSProperties declares no custom properties (`--surface`); React writes them as given.
}

/** The site colour tokens `composePage` hands `resolvePagePalette` to dereference a relative treatment value. */
export type SiteColourTokens = Partial<
  Record<
    'primary' | 'secondary' | 'hover' | 'surface' | 'surface-alt' | 'text-primary' | 'text-secondary' | 'text-inverse',
    string
  >
>;

/** Restates the renderer's `resolvePageBackground`. */
export function pageBackground(token: string | undefined): string | undefined {
  switch (token) {
    case 'surface':
      return 'var(--surface)';
    case 'surface-alt':
      return 'var(--surface-alt)';
    case 'primary':
      return 'var(--primary)';
    case 'secondary':
      return 'var(--secondary)';
    default:
      return undefined;
  }
}

/** Restates the renderer's `resolvePageBackgroundTextRescope`: text on an accent-coloured page reads the inverse ink. */
export function pageBackgroundTextRescope(token: string | undefined): Record<string, string> | undefined {
  if (token !== 'primary' && token !== 'secondary') return undefined;
  return {
    '--text-primary': 'var(--text-inverse, #ffffff)',
    '--text-secondary': 'color-mix(in srgb, var(--text-inverse, #ffffff) 68%, transparent)',
    '--border': 'color-mix(in srgb, var(--text-inverse, #ffffff) 14%, transparent)',
  };
}
