import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { HomeSectionRenderer } from "@/components/HomeSections";
import { getDefaultHomeSections } from "@/components/HomeSections/defaults";
import { prefetchHomeSectionData } from "@/lib/api/homeSectionData";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import HomeLoading from "./loading";

export const dynamic = "force-dynamic";

async function Resolved() {
  const siteData = await getSiteData();
  const pages = siteData.pageConfigs ?? [];

  const sections = (siteData.homeSections ?? getDefaultHomeSections(pages))
    .filter((s) => s.enabled)
    .sort((a, b) => a.order - b.order);

  const prefetchedData = await prefetchHomeSectionData(sections, siteData);

  return (
    <>
      <Navbar />
      {sections.map((section) => (
        <HomeSectionRenderer
          key={`${section.type}-${section.order}`}
          section={section}
          siteData={siteData}
          prefetchedData={prefetchedData[section.type]}
        />
      ))}
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
