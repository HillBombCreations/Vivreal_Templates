import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import { composePage } from "@hillbombcreations/site-renderer";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
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

  // CC9: the email-subscribe popup moved to the shared layout (app/layout.tsx)
  // so it can target any route. The EmailPopup wrapper self-gates — absent
  // config it stays home-only + on-iff-subscribers-collection (legacy), so this
  // route no longer needs to mount or gate it.

  return (
    <>
      <Navbar />
      {composePage(input)}
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
