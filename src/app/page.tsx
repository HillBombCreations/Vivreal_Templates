import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import { composePage } from "@hillbombcreations/site-renderer";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import EmailPopup from "@/components/HomeSections/EmailPopup";
import HomeLoading from "./loading";

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

  // Subscribe popup. composePage composes the page BODY from homePageConfig
  // bindings; the email-subscribe modal is route-level chrome (a self-gating
  // client component). VR_Client_API surfaces the email-subscribe collection as a
  // synthetic `subscribers`-format page in pageConfigs (getSiteDetails) — render
  // the popup whenever one exists. EmailPopup resolves its target collection from
  // that page itself, so no per-site home config is needed.
  const hasSubscribers = (siteData.pageConfigs ?? []).some(
    (p) => p.format === "subscribers",
  );

  return (
    <>
      <Navbar />
      {composePage(input)}
      {hasSubscribers && <EmailPopup config={{}} siteData={siteData} />}
      <Footer />
    </>
  );
}

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
  const domain = siteData?.domainName || "";

  return {
    title: siteName,
    description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
    ...(domain && {
      openGraph: {
        title: siteName,
        description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
        url: `https://${domain}/`,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: siteName,
        description: `Welcome to ${siteName}. Discover our latest content, events, and more.`,
      },
    }),
  };
};
