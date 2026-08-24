import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { resolveSiteOrigin, buildOgImageUrl } from "@/lib/og/ogImage";
import { buildRouteCanonicalMetadata } from "@/lib/seo/routeMetadata";
import { buildPageRobotsMetadata } from "@/lib/seo/pageIndexing";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import { composePage } from "@hillbombcreations/site-renderer";
import type { PageConfig as RendererPageConfig } from "@hillbombcreations/site-renderer";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import HomeLoading from "@/components/HomeLoading";

export const dynamic = "force-dynamic";

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

  // Unified path (Plan 4, step 5): composePage dispatches showcase vs ecommerce
  // internally via isHome + the presence of a sibling 'shows' page — identical to
  // the legacy pageFormats.has('shows') check. The builder's binding scan covers
  // both showcase (shows/partners/reviews bindings) and ecommerce (role-bucketed
  // collection + integration bindings); banner logo fallback + CTA-by-default are
  // owned by composePage's home branches.
  const { input } = await buildPageContext({ siteData, page: homePageConfig, isHome: true });

  // CC9: the email-subscribe popup moved to the shared layout (app/layout.tsx)
  // so it can target any route. The EmailPopup wrapper self-gates — absent
  // config it stays home-only + on-iff-subscribers-collection (legacy), so this
  // route no longer needs to mount or gate it.

  return (
    <>
      <Navbar page={homePageConfig as unknown as RendererPageConfig} />
      {composePage(input)}
      <Footer />
    </>
  );
}

// GUARD NOTE (docs/bugs/templates-soft-404-and-301-status, Change 1c): this
// Suspense boundary is page-authored, not the deleted implicit `loading.tsx`
// wrap — but it has the SAME failure mode. `HomePage` is a synchronous shell;
// `Resolved()` is the async child that does all the awaiting. Streaming
// begins the instant this boundary suspends, which flushes a 200 shell
// before `Resolved()` runs. A `notFound()`/`permanentRedirect()` placed
// inside `Resolved()` (or anything it calls) would be a soft-200 on day one,
// exactly like the bug this fix closes elsewhere. Home never guards today,
// so this is documentary only — no behavioural change. Any future guard on
// this route MUST run in `HomePage` itself (the un-suspended parent), not
// inside `Resolved()`.
export default function HomePage() {
  return (
    <Suspense fallback={<HomeLoading />}>
      <Resolved />
    </Suspense>
  );
}

export const generateMetadata = async () => {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "Home";
  // Home's page config is keyed as slug/format "home" (getSiteData); its `seo`
  // block (if any) drives the Studio-editable overrides.
  const seo = siteData?.homePageConfig?.seo;
  const origin = resolveSiteOrigin(siteData, { surface: 'deployed' });
  const ogImageUrl = buildOgImageUrl(origin, "home");

  const title = seo?.metaTitle || siteName;
  const description =
    seo?.metaDescription ||
    `Welcome to ${siteName}. Discover our latest content, events, and more.`;

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
