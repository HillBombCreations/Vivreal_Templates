import type { SiteData } from '@hillbombcreations/site-renderer';

/**
 * Shared resolver for the site-chrome "which pages does this show on?" gate.
 *
 * The renderer declares this shape on several chrome configs
 * (`EmailPopupConfig.pages`, `AnnouncementStripConfig.pages`) and documents the
 * gate itself as CONSUMER-OWNED — it ships the type and deliberately does not
 * enforce it, because only the consumer knows what route it is rendering. That
 * makes this file the single place the rule is implemented for the live site.
 *
 * It exists because the rule was implemented once (in `EmailPopup`) and NOT AT
 * ALL for the announcement strip, so a founder who set "show the bar on Home
 * only" got it on every page of their site, silently. Two copies of a rule like
 * this is how that happens again; keep it at one.
 *
 * ⚠️ There is a SECOND consumer in another repo: the portal's Studio preview
 * shell (`Vivreal_Portal_Mobile/src/app/(studio-frame)/sites/studio/preview-shell`)
 * must apply the same gate or the editor shows something the live site will not.
 * It cannot import this file. The long-term home for this resolver is the
 * RENDERER package itself (it already owns the types, and both repos depend on
 * it) — move it there at the next renderer bump and delete this. Until then,
 * any change here needs the mirror change there.
 */

type PageGate = NonNullable<NonNullable<SiteData['announcement']>['pages']>;

/**
 * Normalize an authored slug or a URL path segment to one comparable token.
 *
 * The two sides genuinely disagree about the home page and it is not cosmetic:
 * the Studio's page picker stores `UniversalPage.slug`, which for the home page
 * is `'home'` (or occasionally `'/'`), while the live route for that same page
 * is `/` — which strips to the EMPTY STRING. A naive `slugs.includes(current)`
 * therefore never matches home, so "include: Home" silently showed nothing.
 * Both spellings collapse to `''` here.
 */
function normalizeSlug(value: string): string {
  const trimmed = value.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed === '' || trimmed === 'home' ? '' : trimmed;
}

/** The current page's comparable slug, derived from `usePathname()`. */
export function currentSlugFromPathname(pathname: string | null | undefined): string {
  return normalizeSlug(pathname ?? '/');
}

/**
 * Should a gated piece of chrome render on this page?
 *
 * @param gate      the authored `pages` config (absent ⇒ `fallback`)
 * @param slug      the current page's slug, from `currentSlugFromPathname`
 * @param fallback  what an UNAUTHORED gate means for this consumer. The email
 *                  popup's legacy behavior is home-only, the announcement
 *                  strip's is every page — so the caller supplies it rather
 *                  than this function inventing one.
 */
export function isPageAllowed(
  gate: PageGate | null | undefined,
  slug: string,
  fallback: boolean,
): boolean {
  if (!gate?.mode) return fallback;
  if (gate.mode === 'all') return true;

  const slugs = (gate.slugs ?? []).map(normalizeSlug);
  const listed = slugs.includes(slug);

  // An empty list is preserved as literal, NOT reinterpreted as "no restriction":
  // `include` with nothing ticked shows nowhere, `exclude` with nothing ticked
  // shows everywhere. That matches what the words say and what `EmailPopup` has
  // always done — quietly flipping it would change behavior on live sites that
  // are relying on the current reading.
  if (gate.mode === 'include') return listed;
  if (gate.mode === 'exclude') return !listed;

  return fallback;
}
