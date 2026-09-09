import 'server-only';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import {
  composePage,
  ComposedPageSkeleton,
  TitleBand,
  shouldRenderTitleBand,
} from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { buildPageContext } from '@/lib/api/composition/buildPageContext';
import { refuseUnknownEmptiness } from '@/lib/degradedPageRefusal';
import type { PageConfig, SiteData } from '@/types/SiteData';
import type { ProductQuery } from '@/lib/composition/productQuery';

/**
 * composePage component overrides (CompositionOptions.components). Typed
 * loosely here for the same reason [slug]/page.tsx types its `components`
 * local `any`: the installed renderer's CompositionComponentOverrides lags
 * the working-tree keys during bumps. The values are always the live composed
 * wrappers (see liveProductsOverrides.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComposeComponents = any;

// Formats that trigger isEmpty → notFound(). Mirrors [slug]/page.tsx SP-6 Task 5.
const GENERIC_FORMATS = new Set(['standard', 'list', 'grid']);

/**
 * Derive the structure hints ComposedPageSkeleton needs from the SAME page
 * config that drives the real render — format, labels, the primary binding's
 * displayAs, whether a filter (second collection) binding exists, and the
 * enabled block count. All synchronous: no data fetch, so the Suspense
 * fallback below can be page-shaped from the first flush.
 */
export function skeletonPropsFor(composedPage: PageConfig) {
  const blocks = (composedPage.blocks ?? []).filter((b) => b?.enabled !== false);
  let displayAs: string | undefined;
  let hasFilters = false;
  for (const block of blocks) {
    const bindings = (block?.config?.bindings ?? []) as Array<
      { collectionId?: string | null; displayAs?: string } | undefined
    >;
    const collectionBindings = bindings.filter((bd) => !!bd?.collectionId);
    if (collectionBindings.length === 0) continue;
    displayAs ??= collectionBindings[0]?.displayAs;
    // The collection block's second collection binding is the filter binding
    // (renderer blocks.ts `case 'collection'` — primary = first, filter = second).
    if (collectionBindings.length > 1) hasFilters = true;
    break;
  }
  return {
    format: composedPage.format,
    labels: composedPage.labels as Record<string, unknown> | undefined,
    // Renderer default for a collection block's primary binding is 'grid'.
    displayAs: displayAs ?? 'grid',
    hasFilters,
    blockCount: blocks.length || 1,
    slug: composedPage.slug,
  };
}

/**
 * Renders the generic composed-page path (about / standard / list / grid /
 * static / collection-list).
 *
 * Shared between [slug]/page.tsx (generic + static branches) and
 * [slug]/[itemId]/page.tsx (CP-11 nested sub-page branch) so the two cannot drift.
 *
 * Caller MUST pre-shape `composedPage` before calling:
 *  - static/privacy/terms: synthesize labels from getPageLabel, build the PageConfig.
 *  - about/standard/list/grid: pass pageConfig through unchanged.
 *
 * Formats that require runtime component overrides (products, schedule, subscribe)
 * and interactive/detail formats (shows, team, checkout-*) must NOT be routed
 * here — they are handled by their own arms in [slug]/page.tsx.
 *
 * Streaming split (2026-07-13): the shell (Navbar / transitional title band /
 * Footer) renders SYNCHRONOUSLY — siteData + pageConfig are already resolved —
 * while the slow part (buildPageContext's collection fetches + composePage)
 * streams in behind a Suspense boundary whose fallback is the renderer's
 * ComposedPageSkeleton, derived from the same composedPage config. The user
 * sees the real navbar + real page title + a structure-matched shimmer
 * immediately, and the content pops in without layout shift.
 */
export function renderComposedPage({
  siteData,
  composedPage,
  components,
  productQuery,
}: {
  siteData: SiteData;
  composedPage: PageConfig;
  /**
   * Optional composePage component overrides — the live storefront wrappers
   * (LIVE_PRODUCTS_OVERRIDES). An override only fires when composePage renders
   * that arm, so passing them for pages without a storefront is a no-op.
   * Without them a storefront group on a generic/catalog page renders the bare
   * uncontrolled arm — no CartAdapter, so Add/Buy silently no-op (the first
   * live Square E2E bug).
   */
  components?: ComposeComponents;
  /** Server-side products query (f_/search/sort) for the storefront round-trip. */
  productQuery?: ProductQuery;
}) {
  // SP-6 Task 5 Concern-3: transitional title band (B-wrapper fallback).
  //
  // The GATE and the MARKUP both come from the renderer now (>= 1.66.0,
  // preview-parity Wave 4, audit D9). They used to live here, hand-duplicated
  // in [slug]/page.tsx, and re-derived a third time inside the renderer's own
  // mapBlocks — three copies of one condition, each carrying a comment asking
  // the next person to keep them in step. They drifted, and /studio-demo
  // printed "Build a site in under 60 seconds" twice. Worse, the Studio
  // preview rendered no page heading at all, because the band was Templates
  // JSX the preview shell never had: a page title that existed at the URL and
  // not in the editor.
  //
  // `shouldRenderTitleBand` carries every clause this file used to spell out —
  // generic format, an authored labels.title, no section-header block (the
  // B-author model owns the heading), no home-section block, and no synthetic
  // hero banner from mapBlocks. `TitleBand` carries the markup, both the
  // light-chrome layout and the dark full-width gradient, verbatim.
  //
  // The MOUNT POINT stays here deliberately. The renderer also offers
  // `options.titleBand: true`, which renders the band inside composePage; that
  // is the seam the Studio preview uses. This route streams, and the band
  // being synchronous OUTSIDE the Suspense boundary is what puts the real page
  // heading on screen before the collection fetches resolve. Owning the mount
  // point is what obliges this file to keep passing `suppressSrTitle` below,
  // so composePage does not stack its sr-only h1 on top.
  const showTransitionalTitleBand = shouldRenderTitleBand(
    composedPage as unknown as RendererPageConfig,
  );

  // The transitional title band already renders the page title in the shell for
  // generic formats — strip labels from the skeleton there so the fallback
  // doesn't double-render the same heading while streaming.
  const skeletonProps = skeletonPropsFor(composedPage);
  if (showTransitionalTitleBand) skeletonProps.labels = undefined;

  return (
    <>
      <Navbar page={composedPage as unknown as RendererPageConfig} />
      {showTransitionalTitleBand && (
        // The band's markup, both the light-chrome layout and the dark
        // full-width gradient, is the renderer's `TitleBand`. It was carried
        // over from this file verbatim, so a site that renders it today keeps
        // rendering exactly the same bytes.
        <TitleBand
          page={composedPage as unknown as RendererPageConfig}
          chrome={siteData.chrome}
        />
      )}
      {/* GUARD NOTE (docs/bugs/templates-soft-404-and-301-status, Change 1c):
          this is a page-authored Suspense boundary, not the deleted implicit
          loading.tsx wrap — but it has the same failure mode. Streaming
          begins the instant this boundary suspends, which flushes a 200
          shell before ComposedPageBody runs. Unlike home's HYPOTHETICAL
          hazard (app/page.tsx has no notFound() today), ComposedPageBody's
          isEmpty guard DOES call notFound(), which is a real, shipping
          soft-200, not a latent one.

          AMENDED. This note used to end "any future fix to that guard must
          run in the un-suspended parent (above this boundary), not inside
          ComposedPageBody", and the degraded-read guard is inside
          ComposedPageBody, so leaving that sentence standing would have left
          this file carrying two directives that disagree.

          The rule it was reaching for is narrower than it was written:
          anything that needs to set a STATUS must run in the un-suspended
          parent, because from here the status is already committed. The
          degraded guard does not set a status and could not; it replaces a
          body that says "page not found" with one that says "try again",
          which is the half that can be fixed from here. Hoisting it would
          mean awaiting buildPageContext above this boundary and deleting the
          streaming split for every generic page. Reasoning in full at the
          guard itself. */}
      <Suspense fallback={<ComposedPageSkeleton {...skeletonProps} />}>
        <ComposedPageBody
          siteData={siteData}
          composedPage={composedPage}
          components={components}
          productQuery={productQuery}
          suppressSrTitle={showTransitionalTitleBand}
        />
      </Suspense>
      <Footer />
    </>
  );
}

/**
 * The slow half — collection fetches (buildPageContext) + composePage. Runs
 * behind the Suspense boundary above so the shell + skeleton flush first.
 *
 * notFound() note: the isEmpty guard fires mid-stream (after the shell
 * flushed). Next.js handles a notFound() thrown during streaming by emitting a
 * client-side correction to the not-found boundary — the user still lands on
 * the 404 UI. Crawler-visible status for this edge (an EMPTY generic page) is
 * an accepted tradeoff for streaming the 99% case.
 *
 * That accepted tradeoff was only ever priced for a GENUINELY empty page, which
 * is rare and whose 404 is correct. It was never priced for a page with real
 * content whose collection read failed, and until `emptinessUnknown` existed
 * that page took the same branch. See the guard below.
 */
async function ComposedPageBody({
  siteData,
  composedPage,
  components,
  productQuery,
  suppressSrTitle,
}: {
  siteData: SiteData;
  composedPage: PageConfig;
  components?: ComposeComponents;
  productQuery?: ProductQuery;
  /**
   * §11.8 (renderer ≥1.45.1): true when the transitional title band above
   * already renders the page-title h1 — composePage must not add its sr-only
   * fallback h1 on top (the band is chrome outside its section calculus).
   */
  suppressSrTitle?: boolean;
}) {
  const { input, isEmpty, emptinessUnknown } = await buildPageContext({
    siteData,
    page: composedPage,
    isHome: false,
    productQuery,
  });

  // SP-6 Task 5 isEmpty guard — only fires for generic formats.
  // Mirrors the guard in [slug]/page.tsx so the two stay in sync.
  //
  // The refusal is ordered FIRST, and the ordering is the fix. `isEmpty` used
  // to be true whenever the collection read came back empty, and a read that
  // FAILED comes back empty too (the fetch helpers swallow the error and return
  // the caller's fallback). So a transient VR_Client_API wobble answered
  // `notFound()` on real, published pages: a removal signal to every crawler,
  // manufactured out of an absence of data. Same shape as the degraded
  // site-data path (`@/lib/api/siteData/degraded`), but one layer down and on
  // otherwise HEALTHY `siteData`, so the `assertUpstreamHealthy` guard the
  // routes run above this boundary never sees it.
  //
  // Scoped to GENERIC_FORMATS on purpose, the same set the 404 was scoped to.
  // Every other format renders whatever came back and asserts nothing about the
  // page existing, so a refusal there would be a new behaviour change with its
  // own blast radius rather than a fix for this one.
  //
  // WHAT THIS CANNOT DO, AND WHY IT IS STILL WORTH DOING. Per the GUARD NOTE on
  // the boundary above, this component runs after the 200 shell has flushed, so
  // neither branch here can set an HTTP status: the 404 was already a soft 404
  // and the refusal is a soft 5xx. What DOES change is the body, and for a
  // crawler the body is the signal that gets read. Google classifies a soft 404
  // by content, and `not-found.tsx` renders literally "404 / Oops! Page not
  // found", which is the canonical trigger. `error.tsx` renders "We're having
  // trouble loading this page. Please try again in a moment", which is true and
  // not a removal signal, and it captures to Sentry from the client on top of
  // the server-side capture at the swallow.
  //
  // Setting a real status would mean resolving buildPageContext ABOVE the
  // Suspense boundary, which deletes the streaming split for every generic page
  // to buy a correct status on a rare edge. Recorded, not taken.
  if (GENERIC_FORMATS.has(composedPage.format)) {
    if (emptinessUnknown) refuseUnknownEmptiness(composedPage.format);
    if (isEmpty) return notFound();
  }

  // Mirror ComposedFormatBody ([slug]/page.tsx): inject the live component
  // overrides into CompositionOptions when provided; bare composePage otherwise.
  // `input.options!` — buildPageContext always sets options (same non-null
  // assertion ComposedFormatBody uses).
  // `any`: CompositionOptions in the installed renderer can lag working-tree
  // keys during bumps (same tolerance as scheduleView in [slug]/page.tsx);
  // suppressSrTitle lands in ≥1.45.1 and rides inert on older dists.
  const extraOptions = {
    ...(components ? { components } : {}),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(suppressSrTitle ? ({ suppressSrTitle } as any) : {}),
  };
  return (
    <>
      {composePage(
        Object.keys(extraOptions).length
          ? { ...input, options: { ...input.options!, ...extraOptions } }
          : input,
      )}
    </>
  );
}
