import { connection } from 'next/server';
import { optOutOfCachingDegradedRender, optOutOfPrerenderUnlessIsr } from '@/lib/renderMode';

/**
 * The route-facing ISR gate, and the ONE place `connection` is bound to the
 * real Next export. Every route the flip touches calls this as its first
 * statement.
 *
 * The decision and the `connection()` call both live in `renderMode.ts`, which
 * imports nothing from Next so `node --test` can execute it against the REAL
 * `connection` inside Next's REAL prerender work store (`renderMode.test.ts`).
 * This file is wiring only; its single untested claim, that it passes the real
 * `connection`, is source-pinned in that suite.
 *
 * WHY THE CALL IS THE FIRST STATEMENT IN EVERY ROUTE
 * -------------------------------------------------
 * In the off state nothing after it runs during `next build`. That is what
 * keeps a fleet build's VR_Client_API traffic at zero for these routes,
 * matching the pre-change build where `force-dynamic` meant Next never
 * attempted them at all. Move it below a `getSiteData()` call and every fleet
 * build starts making upstream reads it did not make before.
 *
 * WHY IT IS NOT IN THE ROOT LAYOUT
 * --------------------------------
 * A dynamic bailout in a layout cascades to every child. That would drag
 * `/_not-found` (which Phase 1 left as the only genuinely static route in the
 * app) back to dynamic, so the off state would no longer reproduce the
 * pre-change build. The gate stays per route, on exactly the routes being
 * flipped.
 */
export function enforceDynamicUnlessIsr(): Promise<void> {
  return optOutOfPrerenderUnlessIsr(connection);
}

/**
 * The degraded-render cache bail (ISR migration Phase 4, blocker 1), bound to
 * the same real `connection` as the gate above. What it actually causes Next to
 * do — which is NOT "emit an uncacheable 200", and was measured rather than
 * assumed — is documented on `optOutOfCachingDegradedRender` in `renderMode.ts`.
 * Read that before changing anything here.
 *
 * WHERE THIS IS CALLED FROM, AND WHY IT IS ONE PLACE AND NOT SEVEN
 * ---------------------------------------------------------------
 * `getSiteData()` (`src/lib/api/siteData/index.tsx`), on the branch that returns
 * `FALLBACK_SITE_DATA`. That is the one place the degraded value is PRODUCED,
 * so every route that renders from it is covered by construction: `/`,
 * `/[slug]`, `/[slug]/[itemId]`, `/[...segments]`, `robots.txt`, `icon`,
 * `apple-icon`, the root layout, and the Navbar / Footer / StaticPage server
 * components underneath them. Putting it in `page.tsx`'s `!homePageConfig`
 * branch instead would have fixed one route and mis-fired on a legitimate one:
 * a site with no Studio home page config takes that same branch with perfectly
 * healthy data, and that render SHOULD stay cacheable.
 *
 * Not in `clientFetchCached` either, one layer down. Its `fallback` parameter
 * covers every read on the site, most of which degrade mildly (an empty
 * collection list is a thin page, not a wrong one). Opting out there would make
 * most renders uncacheable and give back the whole ISR win. `getSiteData()`
 * failing is the specific condition that means "this site is live and empty".
 */
export function bailOutOfCachingDegradedRender(): Promise<void> {
  return optOutOfCachingDegradedRender(connection);
}
