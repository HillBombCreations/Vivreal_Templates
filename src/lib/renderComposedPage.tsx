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
import type { PageWithBlocks } from '@hillbombcreations/site-renderer/bindings';
import { reportDisplayMismatches } from '@/lib/reportDisplayMismatch';
import { buildPageContext } from '@/lib/api/composition/buildPageContext';
import type { PageContextResult } from '@/lib/api/composition/buildPageContext';
import { emptinessIsDecidable } from '@/lib/api/composition/pageEmptiness';
import RichTextImages from '@/components/RichTextImages';
import ListLoadFailedNotice from '@/components/ListLoadFailedNotice';
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

/**
 * QA-G1-2: the SAME emptiness verdict the render below acts on, for
 * `generateMetadata`, so a page that renders as not found is also titled and
 * indexed as not found. Every read goes through `clientFetchCached`, so on a
 * healthy request the render's own call is served from the same cache entries.
 * A FAILED read is never cached (`unstable_cache` stores no throw), so on an
 * outage these pages read twice per request, accepted in the review of #188.
 * Measured with `next start` (follow-ups to #188): this metadata read and the
 * render's read already make ONE upstream call between them. The second call is
 * this function running again in the separate render pass Next makes for the
 * 500 response, which gets a fresh React `cache` scope, so a request-scoped
 * cache keyed on the URL string (tried, and it did hit for the first pair)
 * cannot reach it. It was not kept. V2 closed it at module scope instead: a
 * failed `clientFetchCached` read is answered from a 5 s failure memo, so that
 * second pass makes no upstream call (`src/lib/api/failureMemo.ts`).
 * Only `isEmpty`: an unknown verdict (a failed read) is never called empty, and
 * a page searched or filtered by the shopper is never empty
 * (`emptinessIsDecidable`).
 */
export async function composedPageIsEmpty(args: {
  siteData: SiteData;
  composedPage: PageConfig;
  productQuery?: ProductQuery;
}): Promise<boolean> {
  if (!emptinessIsDecidable(args.composedPage, args.productQuery)) return false;
  const { isEmpty } = await buildPageContext({
    siteData: args.siteData,
    page: args.composedPage,
    isHome: false,
    productQuery: args.productQuery,
  });
  return isEmpty;
}

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
export async function renderComposedPage({
  siteData,
  composedPage,
  components,
  productQuery,
  lookupQuery,
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
  /**
   * The reader's search query on a `format:'lookup'` page (help-site kit 5.6).
   *
   * `composePage` has no request, so this is the only channel the results
   * grammar has to the URL. Undefined on every other format — and, on a lookup
   * page reached with no query, undefined is CORRECT and means "show the whole
   * collection", which is the landing state of a results page nobody has
   * searched yet.
   */
  lookupQuery?: string;
}) {
  // QA-G1-2: a REAL 404 for an empty generic page. The emptiness verdict needs
  // the page's collection reads, and a status can only be set before the first
  // byte flushes, which is the instant the Suspense boundary below suspends. So
  // a page that COULD be empty has its data read here, above the boundary, and
  // the resolved context is handed to the body, which then renders it without
  // reading again: one read per request, as before.
  //
  // Only pages that could be empty pay for it. A page with authored copy (a
  // written hero, static prose, a form) is never empty whatever its lists hold,
  // so it skips this read and streams exactly as before. The pages that wait are
  // the ones whose whole body is collection items, which show nothing useful
  // until those reads land anyway.
  //
  // Ordering is the old body guard's, unchanged: a failed read REFUSES (a 5xx,
  // now a real one too, "come back later") before an empty read can 404, because
  // a failed read and an empty collection are the same `[]`. The 404 is never
  // page-cached: every caller that can reach it awaits `searchParams` first, so
  // the route is dynamic even under ISR (`no-store`). The static arm of
  // [slug]/page.tsx does not await it, and needs not to: `static` is not a
  // generic format, so `emptinessIsDecidable` is false there and no 404 is
  // decided. It lasts only as long as the
  // collection's data-cache entry (`SITE_CACHE_TTL_SECONDS`), and the portal's
  // save webhook (`/api/revalidate`) drops the `collection:<id>` tag these reads
  // carry, so the next request answers 200 once the page has content.
  //
  // A shopper's search or filter skips all of this (`emptinessIsDecidable`): the
  // products read counts matches, so zero is "no matches", never "no page".
  let context: PageContextResult | undefined;
  if (emptinessIsDecidable(composedPage, productQuery)) {
    context = await buildPageContext({
      siteData,
      page: composedPage,
      isHome: false,
      productQuery,
    });
    if (context.emptinessUnknown) refuseUnknownEmptiness(composedPage.format);
    if (context.isEmpty) notFound();
  }

  // F-C7: one event per render when a block's displayAs and type disagree.
  // Cast: the Templates page mirror and the renderer's block page differ only
  // in presentation fields the reading never touches.
  reportDisplayMismatches(composedPage as unknown as PageWithBlocks, composedPage.slug);

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
          streaming begins the instant this boundary suspends, which flushes a
          200 shell before ComposedPageBody runs. Anything that must set a
          STATUS therefore runs above this boundary, and since QA-G1-2 the
          emptiness guard does (top of renderComposedPage), so an empty page
          answers a real 404 and a failed read a real 5xx. Nothing inside
          ComposedPageBody may call notFound(). */}
      <Suspense fallback={<ComposedPageSkeleton {...skeletonProps} />}>
        <ComposedPageBody
          siteData={siteData}
          composedPage={composedPage}
          components={components}
          productQuery={productQuery}
          lookupQuery={lookupQuery}
          suppressSrTitle={showTransitionalTitleBand}
          context={context}
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
 * When `renderComposedPage` already read the page's data to decide emptiness
 * (QA-G1-2), that `context` is passed in and rendered as is, so the read
 * happens once. The emptiness guard lives above the boundary, not here: from
 * here a 404 could only swap the body under an already-committed 200.
 */
async function ComposedPageBody({
  siteData,
  composedPage,
  components,
  productQuery,
  lookupQuery,
  suppressSrTitle,
  context,
}: {
  siteData: SiteData;
  composedPage: PageConfig;
  components?: ComposeComponents;
  productQuery?: ProductQuery;
  /** The reader's `?q=` on a `format:'lookup'` page. See renderComposedPage. */
  lookupQuery?: string;
  /**
   * §11.8 (renderer ≥1.45.1): true when the transitional title band above
   * already renders the page-title h1 — composePage must not add its sr-only
   * fallback h1 on top (the band is chrome outside its section calculus).
   */
  suppressSrTitle?: boolean;
  /** The context `renderComposedPage` already read, when it had to (QA-G1-2). */
  context?: PageContextResult;
}) {
  const { input, richTextImageUrls, listReadFailed } =
    context ??
    (await buildPageContext({
      siteData,
      page: composedPage,
      isHome: false,
      productQuery,
    }));

  // No emptiness guard here. Since QA-G1-2 it runs above the Suspense boundary
  // in `renderComposedPage`, where a 404 is a real status. A page that skipped
  // the early read is either one `pageCouldBeEmpty` rules out (so
  // `decidePageEmptiness` can only answer not-empty for it) or one the shopper
  // searched or filtered, whose zero rows mean "no matches" and must render.

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
    // Only when a query was actually read, so every non-lookup format's options
    // object stays byte-identical and composePage's own `format === 'lookup'`
    // gate stays the thing that decides whether any of this runs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(lookupQuery !== undefined ? ({ lookupQuery } as any) : {}),
  };
  // H177: the inline rich-text image resolver.
  //
  // It is mounted HERE, inside the Suspense boundary, and not up in
  // `renderComposedPage` beside Navbar/TitleBand. The map is a RESULT of
  // `buildPageContext`, which is the await this component exists to hold; the
  // shell above has not got it yet and could only get it by awaiting the same
  // call, which would delete the streaming split for every generic page.
  //
  // Nothing in the synchronous shell needs it: Navbar, TitleBand and Footer are
  // Templates chrome, not CMS rich text.
  // RW4-6: a failed list read on a page with other content. See the component.
  return (
    <>
      {listReadFailed && <ListLoadFailedNotice />}
      <RichTextImages map={richTextImageUrls}>
        {composePage(
          Object.keys(extraOptions).length
            ? { ...input, options: { ...input.options!, ...extraOptions } }
            : input,
        )}
      </RichTextImages>
    </>
  );
}
