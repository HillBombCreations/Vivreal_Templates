import { getSiteData } from "@/lib/api/siteData";
import { assertUpstreamHealthy } from "@/lib/api/siteData/degraded";
import { resolveSitePublicBase, buildOgImageUrl } from "@/lib/og/ogImage";
import { buildRouteCanonicalMetadata } from "@/lib/seo/routeMetadata";
import { buildPageRobotsMetadata } from "@/lib/seo/pageIndexing";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import { composePage, renderedHeroFor } from "@hillbombcreations/site-renderer";
import RichTextImages from "@/components/RichTextImages";
import ListLoadFailedNotice from "@/components/ListLoadFailedNotice";
import { JsonLd } from "@/components/JsonLd";
import { pageListingEventsJsonLd } from "@/lib/seo/listingEvents";
import type { PageConfig as RendererPageConfig } from "@hillbombcreations/site-renderer";
import Navbar from "@/components/Navigation/Navbar";
import { darkRenderedHero } from "@/components/Navigation/darkRenderedHero";
import Footer from "@/components/Footer";
import { enforceDynamicUnlessIsr } from "@/lib/renderGate";
import { homeMetaText, readBusinessFacts } from "@/lib/seo/pageMetaText";
import type { PageWithBlocks } from "@hillbombcreations/site-renderer/bindings";
import { reportDisplayMismatches } from "@/lib/reportDisplayMismatch";

// ISR migration Phase 3. `revalidate` must be a literal — Next 16 parses it
// out of this file's source and hard-fails the build on any expression, so
// the SITE_RENDER_MODE gate cannot live here. It lives in the render, in
// `enforceDynamicUnlessIsr()`. Keep this in step with ISR_REVALIDATE_SECONDS
// (`src/lib/renderMode.ts`); `renderMode.test.ts` fails if they drift.
export const revalidate = 300;

async function Resolved() {
  const siteData = await getSiteData();
  const homePageConfig = siteData.homePageConfig;

  // No portal home config — keep the route-level welcome fallback (composePage
  // has no branch for it).
  if (!homePageConfig) {
    return (
      <>
        <Navbar />
        <div className="content-grid py-20 text-center">
          <h1 className="text-3xl font-bold">Welcome</h1>
          <p className="mt-4 text-lg text-black/50">
            {siteData.businessInfo?.description || "Discover our latest content, events, and more."}
          </p>
        </div>
        <Footer />
      </>
    );
  }

  // F-C7: one event per render when a home block's displayAs and type disagree.
  // Cast: see renderComposedPage.tsx, same reading.
  reportDisplayMismatches(homePageConfig as unknown as PageWithBlocks, 'home');

  // Unified path (Plan 4, step 5): composePage dispatches showcase vs ecommerce
  // internally via isHome + the presence of a sibling 'shows' page — identical to
  // the legacy pageFormats.has('shows') check. The builder's binding scan covers
  // both showcase (shows/partners/reviews bindings) and ecommerce (role-bucketed
  // collection + integration bindings); banner logo fallback + CTA-by-default are
  // owned by composePage's home branches.
  const { input, richTextImageUrls, listReadFailed } = await buildPageContext({
    siteData,
    page: homePageConfig,
    isHome: true,
  });

  // Owner find 3 (renderer 1.92.0): on a Mood dark site only, the hero as it
  // will render, so the header's page-top answer matches a feature-item hero
  // that falls through to the plain dark panel. Spread, so a non-Dark site
  // passes no prop at all. See src/components/Navigation/darkRenderedHero.ts.
  const renderedHero = darkRenderedHero(siteData.chrome, input, renderedHeroFor);

  // CC9: the email-subscribe popup moved to the shared layout (app/layout.tsx)
  // so it can target any route. The EmailPopup wrapper self-gates — absent
  // config it stays home-only + on-iff-subscribers-collection (legacy), so this
  // route no longer needs to mount or gate it.

  return (
    <>
      <Navbar
        page={homePageConfig as unknown as RendererPageConfig}
        {...(renderedHero ? { renderedHero } : {})}
      />
      {/* RW4-6: a failed list read must not be page-cached. See the component. */}
      {listReadFailed && <ListLoadFailedNotice />}
      {/* H177: the resolver wraps the COMPOSED BODY only. Navbar and Footer are
          Templates chrome and carry no CMS rich text, so widening the boundary
          would buy nothing and put a client component above the whole page. */}
      <RichTextImages map={richTextImageUrls}>{composePage(input)}</RichTextImages>
      <Footer />
      {/* F33: Event markup for the dated rows this body draws, from the same input. LAST, so no sibling above moves and every useId the page draws stays the same. */}
      <JsonLd schema={pageListingEventsJsonLd(siteData, input, "/")} />
    </>
  );
}

// GUARD NOTE (docs/bugs/templates-soft-404-and-301-status, Change 1c; F323):
// this route has no page-authored box (release C, F323). Before F323 a
// `<Suspense fallback={<HomeLoading />}>` wrapped `Resolved()`: the home page
// reached readers that run no scripts as a grey box with the whole body hidden,
// and a guard inside `Resolved()` could only swap the body under a 200 already
// on the wire. Now the page is sent complete, so a guard anywhere in the render
// sets a real status. Adding a box back fails `pageBoundaries.test.ts` and the
// build check's no-script read (`scripts/isr-build-check.mjs`).
//
// The degraded-render guard below still runs here, first, so a failed read is
// refused before any of the page is drawn.
export default async function HomePage() {
  // ISR gate. FIRST statement: with SITE_RENDER_MODE unset nothing below this
  // line runs during `next build`, which is what keeps a fleet build's upstream
  // traffic identical to the pre-change build.
  await enforceDynamicUnlessIsr();
  // The 2026-08-31 incident in one line. A degraded read has no
  // `homePageConfig`, so `Resolved()` served the customer's home page as
  // `<h1>Welcome</h1>` with a `Home` title and zero occurrences of their brand,
  // at HTTP 200. ISR Phase 4 stopped that render being CACHED; it never stopped
  // it being SERVED, and a crawler that reads it once is unaffected by how
  // briefly it was stored.
  //
  // Guarded on `degraded`, deliberately NOT on `!homePageConfig`, which is the same
  // distinction `renderGate.ts` draws about where the cache bail belongs. A
  // healthy site with no Studio home config renders the welcome placeholder
  // exactly as it always has. Only a failed read is refused.
  //
  // The extra read is free: `getSiteData()` goes through `unstable_cache` and
  // `Resolved()` asks for the same value in the same request.
  assertUpstreamHealthy(await getSiteData());
  return <Resolved />;
}

export const generateMetadata = async () => {
  // Same gate as the page. Without it a gate-off build would still run this
  // function and make a `siteDetails` read per gated route that
  // `force-dynamic` used to skip entirely.
  await enforceDynamicUnlessIsr();
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "Home";
  // Home's page config is keyed as slug/format "home" (getSiteData); its `seo`
  // block (if any) drives the Studio-editable overrides.
  const seo = siteData?.homePageConfig?.seo;
  const origin = resolveSitePublicBase(siteData, { surface: 'deployed' });
  const ogImageUrl = buildOgImageUrl(origin, "home");

  // The owner's own title and summary win; below them, the business facts
  // (search R4: what and where), then today's welcome line. See
  // `src/lib/seo/pageMetaText.ts`.
  const { title, description } = homeMetaText({
    seo,
    facts: readBusinessFacts(siteData?.businessInfo, siteData?.name, siteData?.siteInfo),
  });

  return {
    title,
    description,
    // Studio W6 — per-page search visibility (see [slug]/page.tsx). Available on
    // home too: rare, but a site can legitimately be link-only while it is being
    // built out, and having the toggle silently do nothing on one page would be
    // worse than not offering it.
    //
    // Routed through the shared composer rather than reading `seo?.noindex`
    // inline. `buildSitemapEntries` now drops the sitemap's ROOT entry for an
    // author-hidden home page, and it decides that by calling the same module;
    // an inline read here would be the second reader of the field the whole
    // point of that module is to prevent. Output is unchanged for home: the
    // format rule cannot fire on `home`, so this is `noindex, nofollow` when the
    // toggle is off and no `robots` key at all otherwise, exactly as before.
    ...buildPageRobotsMetadata(siteData?.homePageConfig),
    ...buildRouteCanonicalMetadata(siteData, '/'),
    openGraph: {
      title,
      description,
      url: `${origin}/`,
      type: "website",
      siteName,
      images: [ogImageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
};
