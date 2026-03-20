import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { getPageData } from "@/lib/api/pageData";
import ContentRenderer from "@/components/ContentRenderer";
import PageShell from "@/components/PageShell";
import CTASection from "@/components/HomeSections/CTASection";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import HomeLoading from "./loading";

export const dynamic = "force-dynamic";

async function Resolved() {
  const siteData = await getSiteData();
  const homePageConfig = siteData.homePageConfig;

  if (!homePageConfig) {
    // Fallback for sites with no home page config
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

  const pageData = await getPageData(homePageConfig);

  // Per-page CTA: enabled by default, controllable from portal
  const ctaConfig = homePageConfig.cta ?? {};
  const showCta = homePageConfig.cta?.enabled !== false;

  return (
    <>
      <Navbar />
      <PageShell
        title={homePageConfig.labels?.title}
        subtitle={homePageConfig.labels?.subtitle}
        sidebar={
          pageData.sidebar.length > 0
            ? <>{pageData.sidebar.map((s, i) => (
                <ContentRenderer
                  key={`sidebar-${i}`}
                  items={s.items}
                  displayAs={s.displayAs}
                  slug="home"
                  detailEnabled={false}
                  accent={siteData.primary}
                />
              ))}</>
            : undefined
        }
        supplemental={
          pageData.supplemental.length > 0
            ? <>{pageData.supplemental.map((s, i) => (
                <ContentRenderer
                  key={`supp-${i}`}
                  items={s.items}
                  displayAs={s.displayAs}
                  slug="home"
                  detailEnabled={false}
                  accent={siteData.primary}
                />
              ))}</>
            : undefined
        }
      >
        {[...pageData.primary, ...pageData.secondary].map((section, i) => (
          <ContentRenderer
            key={i}
            items={section.items}
            displayAs={section.displayAs}
            slug="home"
            detailEnabled={false}
            accent={siteData.primary}
          />
        ))}
      </PageShell>
      {showCta && (
        <CTASection
          config={ctaConfig}
          siteData={siteData}
          prefetchedData={{}}
        />
      )}
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
