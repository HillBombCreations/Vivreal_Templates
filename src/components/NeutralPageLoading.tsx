/**
 * Shape-neutral route-level loading chrome.
 *
 * Route-level `loading.tsx` fallbacks are data-less by construction — they
 * render before params/siteData exist, so they CANNOT know which page they
 * front. The old approach guessed a shape (home hero bands / a 3-col card
 * grid), which was wrong whenever the target page differed — a catalog page
 * booting behind a hero-shaped skeleton reads as jank.
 *
 * New model: the route-level fallback is deliberately SHAPE-NEUTRAL (navbar
 * bar + bare surface) and every page renders its own structure-derived
 * skeleton the moment its config resolves — `ComposedPageSkeleton` behind the
 * page-owned Suspense boundary (see renderComposedPage / [slug]/page.tsx),
 * `HomeLoading` behind the home page's inline boundary. The first SHAPED
 * skeleton the user sees is always the right shape.
 *
 * Theme-correct by construction: the layout SSRs the palette tokens onto
 * <html>, so var(--surface) here is the site's real surface color on the
 * very first paint (no white flash on dark sites).
 */
export default function NeutralPageLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface, #ffffff)' }}>
      <div
        className="h-16 border-b"
        style={{
          borderColor: 'color-mix(in srgb, var(--text-primary, #000) 6%, transparent)',
          background: 'color-mix(in srgb, var(--surface, #fff) 80%, transparent)',
        }}
      />
    </div>
  );
}
