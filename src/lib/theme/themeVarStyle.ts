/**
 * Theme tokens SSR'd onto `<html>` so the FIRST paint, including route-level
 * `loading.tsx` skeletons, is palette-correct, and stamped again by the
 * `Providers` effect after load. Both call this one function.
 *
 * Owner find 3 (renderer 1.90.0): this is the renderer's `themeTokenStyle`,
 * the one builder the Studio preview uses too, so the live site and the
 * preview can no longer drift. It is Templates' old whitelist plus `border`
 * (stored on live sites and read by the renderer's `var(--border` rules, which
 * before this only got it from the after-load string loop), `--font-mono` from
 * `resolveMonoFamily` (a kit's `font-mono`, else the Type pack's
 * `typography.monoFamily`), `--accent-readable` for a hex primary, and a
 * derived `--text-secondary` when none is stored. Nothing else: `favicon`,
 * `chrome`, `fontFamily` and every other stored string stay off the root.
 *
 * THE WHITELIST IS NOW THE ONLY PATH. Before this, `Providers` stamped every
 * string field, so a stored key off the list still reached the page after
 * load. Now a stored theme key reaches the page only if it is on the
 * renderer's `THEME_TOKEN_KEYS`: add a new one there first, publish, bump here,
 * and run `themeParity.test.ts`. Known readers that can therefore never get a
 * value from site settings (each draws its own fallback, and no site stores
 * them): `--button-radius`, `--button-case`, `--button-tracking`,
 * `--card-radius`, `--on-primary`, `--danger`, `--warning`,
 * `--gradient-primary`, `--gradient-primary-start`, `--gradient-primary-end`,
 * `--gradient-accent-start`, `--gradient-accent-end`. See CLAUDE.md, "All
 * Branding is Data-Driven".
 *
 * Kept as a module, not inlined at the two call sites, so the layout and
 * `Providers` keep importing one Templates path and the plain-Node tests can
 * prove that path IS the renderer's function (`themeVarStyle.test.ts`). The
 * `./theme` subpath is React-free, so it loads under `node --test`.
 * `themeParity.test.ts` holds the old-against-new fleet parity run (gate G-T
 * step 6).
 */
export { themeTokenStyle as themeVarStyle, THEME_TOKEN_KEYS } from '@hillbombcreations/site-renderer/theme';
