import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { getPageData } from "@/lib/api/pageData";
import ContentRenderer from "@/components/ContentRenderer";
import CTASection from "@/components/HomeSections/CTASection";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import HomeLoading from "./loading";

export const dynamic = "force-dynamic";

async function Resolved() {
  const siteData = await getSiteData();
  const homePageConfig = siteData.homePageConfig;

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

  const pageData = await getPageData(homePageConfig);
  const allSections = [...pageData.primary, ...pageData.secondary];

  const ctaConfig = homePageConfig.cta ?? {};
  const showCta = homePageConfig.cta?.enabled !== false;

  return (
    <>
      <Navbar />

      {/* Sections rendered directly — no PageShell wrapper.
          Each ContentRenderer handles its own content-grid constraint
          (full-bleed types like banner skip it). */}
      <div className="space-y-16 pb-16">
        {allSections.map((section, i) => (
          <ContentRenderer
            key={i}
            items={section.items}
            displayAs={section.displayAs}
            label={section.label}
            slug="home"
            detailEnabled={false}
            accent={siteData.primary}
          />
        ))}

        {/* Supplemental sections */}
        {pageData.supplemental.length > 0 && (
          <div className="content-grid space-y-16">
            {pageData.supplemental.map((s, i) => (
              <ContentRenderer
                key={`supp-${i}`}
                items={s.items}
                displayAs={s.displayAs}
                label={s.label}
                slug="home"
                detailEnabled={false}
                accent={siteData.primary}
              />
            ))}
          </div>
        )}
      </div>

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
