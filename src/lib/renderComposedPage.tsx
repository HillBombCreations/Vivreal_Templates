import 'server-only';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import { composePage, ComposedPageSkeleton } from '@hillbombcreations/site-renderer';
import type { PageConfig as RendererPageConfig } from '@hillbombcreations/site-renderer';
import { buildPageContext } from '@/lib/api/composition/buildPageContext';
import { willRenderHeroBanner, hasHomeSectionBlock } from '@/lib/heroBanner';
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
  const format = composedPage.format;

  // SP-6 Task 5 Concern-3: transitional title band (B-wrapper fallback).
  // Mirrors [slug]/page.tsx exactly. Self-disables once the page carries a
  // section-header block (B-author model). Synchronous — stays in the shell.
  const isGenericFormat = GENERIC_FORMATS.has(format);
  const hasLabelTitle = !!(composedPage.labels?.title);
  const hasSectionHeaderBlock = (composedPage.blocks ?? []).some(
    (b) => b?.type?.dispatchId === 'section-header',
  );
  // Part 2 dedupe (2026-07-10): a standard page authored with BOTH
  // labels.buttonLabel + labels.buttonLink gets a synthetic hero banner from
  // the renderer's mapBlocks (composePage below, kind:'banner') that ALREADY
  // renders this same labels.title + subtitle + button. Without this guard the
  // bare title band ABOVE the banner double-renders the same title (confirmed
  // on /studio-demo: "Build a site in under 60 seconds" appeared twice — once
  // bare/button-less here, once correctly inside the banner with its button).
  // A page without both fields is unaffected — same band as today. See
  // `heroBanner.ts` for the shared gate (kept in lockstep with the renderer's
  // own condition, single source of truth for both page wrappers).
  // Gate-2 masthead dedupe: a page with a real home-section hero block (the
  // masthead-carousel prepend) renders its own H1 — the bare band above it
  // would double-title AND push the 100svh masthead below the fold top.
  const showTransitionalTitleBand =
    isGenericFormat && hasLabelTitle && !hasSectionHeaderBlock &&
    !hasHomeSectionBlock(composedPage) && !willRenderHeroBanner(composedPage);

  // Dark-chrome transitional title band: when siteData.chrome === 'dark', the
  // band gets a full-width navy gradient (matching BannerLayout / SectionHeaderBlock
  // dark treatment) with text-inverse text, centered layout, and generous padding.
  // Light-chrome behavior is byte-identical to the previous implementation.
  const darkChrome = siteData.chrome === 'dark';

  // The transitional title band already renders the page title in the shell for
  // generic formats — strip labels from the skeleton there so the fallback
  // doesn't double-render the same heading while streaming.
  const skeletonProps = skeletonPropsFor(composedPage);
  if (showTransitionalTitleBand) skeletonProps.labels = undefined;

  return (
    <>
      <Navbar page={composedPage as unknown as RendererPageConfig} />
      {showTransitionalTitleBand && (
        // Transitional title band: renders the legacy page.labels.title/subtitle
        // so generic pages that haven't been SP-3-backfilled still show their H1.
        // Self-disables once the page carries a section-header block (B-author model).
        darkChrome ? (
          // Dark-chrome: full-width navy hero band, centered, text-inverse.
          // Outer div carries the full-width background; inner content-grid constrains
          // the text (same split used by BannerLayout and SectionHeaderBlock dark mode).
          <div
            style={{
              background:
                'linear-gradient(135deg, var(--surface-alt, #1a1a2e), color-mix(in srgb, var(--surface-alt, #1a1a2e) 88%, var(--primary, #111)))',
            }}
          >
            <div className="content-grid pt-32 pb-16 text-center">
              <h1
                className="text-3xl md:text-5xl font-bold tracking-tight"
                style={{ color: 'var(--text-inverse, #ffffff)', fontFamily: 'var(--font-display)' }}
              >
                {composedPage.labels.title}
              </h1>
              {composedPage.labels.subtitle && (
                <p
                  className="mt-4 text-base md:text-lg max-w-2xl mx-auto leading-relaxed"
                  style={{ color: 'color-mix(in srgb, var(--text-inverse, #fff) 70%, transparent)' }}
                >
                  {composedPage.labels.subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          // Light-chrome: legacy layout (content-grid pt-28 pb-0, left-aligned h1).
          <div className="content-grid pt-28 pb-0">
            <header className="mb-8">
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                {composedPage.labels.title}
              </h1>
              {composedPage.labels.subtitle && (
                <p className="mt-2 text-lg text-muted-foreground">
                  {composedPage.labels.subtitle}
                </p>
              )}
            </header>
          </div>
        )
      )}
      {/* GUARD NOTE (docs/bugs/templates-soft-404-and-301-status, Change 1c):
          this is a page-authored Suspense boundary, not the deleted implicit
          loading.tsx wrap — but it has the same failure mode. Streaming
          begins the instant this boundary suspends, which flushes a 200
          shell before ComposedPageBody runs. Unlike home's HYPOTHETICAL
          hazard (app/page.tsx has no notFound() today), ComposedPageBody's
          isEmpty guard DOES call notFound() at :256 — that is a real,
          shipping soft-200, not a latent one. Any future fix to that guard
          must run in the un-suspended parent (above this boundary), not
          inside ComposedPageBody. */}
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
 * notFound() note: the isEmpty guard now fires mid-stream (after the shell
 * flushed). Next.js handles a notFound() thrown during streaming by emitting a
 * client-side correction to the not-found boundary — the user still lands on
 * the 404 UI. Crawler-visible status for this edge (an EMPTY generic page) is
 * an accepted tradeoff for streaming the 99% case.
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
  const { input, isEmpty } = await buildPageContext({
    siteData,
    page: composedPage,
    isHome: false,
    productQuery,
  });

  // SP-6 Task 5 isEmpty guard — only fires for generic formats.
  // Mirrors the guard in [slug]/page.tsx so the two stay in sync.
  if (isEmpty && GENERIC_FORMATS.has(composedPage.format)) {
    return notFound();
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
