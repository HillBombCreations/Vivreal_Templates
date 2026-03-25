import { Suspense } from "react";
import { getSiteData } from "@/lib/api/siteData";
import { getPageData } from "@/lib/api/pageData";
import { getShowsPaginated } from "@/lib/api/shows";
import { getPartners } from "@/lib/api/partners";
import Link from "next/link";
import Image from "next/image";
import ContentRenderer from "@/components/ContentRenderer";
import { HeroSectionShowcase, CTASectionTemplate } from "@vivreal/site-renderer";
import type { SiteData as RendererSiteData } from "@vivreal/site-renderer";
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

  const collections = homePageConfig.collections ?? [];
  const ctaConfig = homePageConfig.cta ?? {};
  const showCta = homePageConfig.cta?.enabled !== false;

  // Detect site type from page formats — reliable, doesn't depend on collection names
  const pageFormats = new Set((siteData.pageConfigs ?? []).map((p) => p.format));
  const isShowcase = pageFormats.has('shows');

  // Find specific bindings for showcase layout
  const showsPage = siteData.pageConfigs?.find((p) => p.format === 'shows');
  const showsColId = showsPage?.collections?.[0]?.collectionId;
  const showsBinding = isShowcase
    ? collections.find((c) => showsColId && c.collectionId === showsColId) ?? collections[0]
    : null;
  const partnersBinding = isShowcase
    ? collections.find((c) => c.role === 'supplemental' && c.displayAs === 'carousel')
    : null;
  const reviewsBinding = isShowcase
    ? collections.find((c) => c.displayAs === 'reviews')
    : null;

  if (isShowcase) {
    // ── Showcase layout: HeroSection + shows + partners + testimonials + CTA ──

    // Fetch shows for the hero section
    const showsCollectionId = showsBinding?.collectionId ?? '';
    const { shows } = showsCollectionId
      ? await getShowsPaginated({ collectionId: showsCollectionId, limit: 100, skip: 0 })
      : { shows: [] };

    // Fetch partners
    const partnersCollectionId = partnersBinding?.collectionId ?? '';
    const partners = partnersCollectionId
      ? await getPartners(partnersCollectionId)
      : [];

    // Fetch reviews/testimonials
    const reviewsCollectionId = reviewsBinding?.collectionId ?? '';
    let reviewItems: { items: import("@/types/ContentItem").ContentItem[] } = { items: [] };
    if (reviewsCollectionId) {
      const { getCollectionItems } = await import("@/lib/api/collections");
      reviewItems = await getCollectionItems(reviewsCollectionId);
    }

    // Build labels for the hero section
    const showsPage = siteData.pageConfigs?.find((p) => p.format === 'shows');
    const heroLabels = {
      upcoming: (showsPage?.labels?.upcoming as string) || 'Upcoming',
      past: (showsPage?.labels?.past as string) || 'Past',
    };

    return (
      <>
        <Navbar />

        <HeroSectionShowcase
          siteData={siteData as unknown as RendererSiteData}
          shows={shows}
          partners={partners}
          labels={heroLabels}
          showsSlug={showsPage?.slug || 'shows'}
          LinkComponent={Link}
          ImageComponent={Image}
        />

        {/* Testimonials / Reviews */}
        {reviewItems.items.length > 0 && (
          <ContentRenderer
            items={reviewItems.items}
            displayAs={reviewsBinding?.displayAs ?? 'reviews'}
            label={reviewsBinding?.name ?? 'What People Are Saying'}
            slug="home"
            detailEnabled={false}
            accent={siteData.primary}
          />
        )}

        {showCta && (
          <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />
        )}

        <Footer />
      </>
    );
  }

  // ── Ecommerce / generic layout: Banner + collection sections + CTA ──

  const pageData = await getPageData(homePageConfig);
  const allSections = [...pageData.primary, ...pageData.secondary];

  return (
    <>
      <Navbar />

      {/* Hero banner — rendered from page labels */}
      {(homePageConfig.labels?.title || homePageConfig.labels?.heroImage) && (
        <ContentRenderer
          items={[]}
          displayAs="banner"
          slug="home"
          detailEnabled={false}
          accent={siteData.primary}
          pageLabels={homePageConfig.labels}
        />
      )}

      {/* Collection sections */}
      <div className="pb-16">
        {allSections.map((section, i) => (
          <ContentRenderer
            key={i}
            items={section.items}
            displayAs={section.displayAs}
            label={section.label}
            subtitle={section.subtitle}
            slug="home"
            detailEnabled={false}
            accent={siteData.primary}
            pageLabels={homePageConfig.labels}
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
                subtitle={s.subtitle}
                slug="home"
                detailEnabled={false}
                accent={siteData.primary}
                pageLabels={homePageConfig.labels}
              />
            ))}
          </div>
        )}
      </div>

      {showCta && (
        <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />
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
