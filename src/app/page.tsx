import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { HomeSectionRenderer } from "@/components/HomeSections";
import { getDefaultHomeSections } from "@/components/HomeSections/defaults";
import { prefetchHomeSectionData } from "@/lib/api/homeSectionData";
import type { HomeSection } from "@/types/SiteData";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import HomeLoading from "./loading";

export const dynamic = "force-dynamic";

async function Resolved() {
  const siteData = await getSiteData();
  const pages = siteData.pageConfigs ?? [];
  const homePageConfig = siteData.homePageConfig;

  let sections: HomeSection[];
  if (homePageConfig) {
    // New path: convert page bindings to HomeSection format
    sections = (homePageConfig.collections ?? [])
      .filter((c) => c.displayAs === "section" && c.enabled !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((c) => ({
        type: c.sectionType ?? "unknown",
        order: c.order ?? 0,
        enabled: true,
        config: {
          collectionId: c.collectionId,
          ...((c.sectionConfig ?? {}) as Record<string, unknown>),
        },
      }));
  } else {
    // Legacy fallback
    sections = (siteData.homeSections ?? getDefaultHomeSections(pages))
      .filter((s) => s.enabled)
      .sort((a, b) => a.order - b.order);
  }

  const prefetchedData = await prefetchHomeSectionData(sections, siteData);

  // Handle CTA from homePageConfig if available
  const ctaConfig = homePageConfig?.cta;

  return (
    <>
      <Navbar />
      {sections.map((section) => (
        <HomeSectionRenderer
          key={`${section.type}-${section.order}`}
          section={section}
          siteData={siteData}
          prefetchedData={prefetchedData[`${section.type}-${section.order}`]}
        />
      ))}
      {ctaConfig?.enabled !== false && !sections.some(s => s.type === 'cta') && (
        <HomeSectionRenderer
          key="cta-from-page"
          section={{ type: "cta", order: 999, enabled: true, config: ctaConfig ?? {} }}
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
