import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/HomeSections/CTASection";
import { getSiteData, getPageLabel, getPageCollectionId } from "@/lib/api/siteData";
import { getPageBySlug } from "@/lib/pages";
import { getShowsPaginated } from "@/lib/api/shows";
import { getTeamMembers } from "@/lib/api/team";
import { getProducts, getFilters } from "@/lib/api/products";
import ShowPageClient from "@/components/PageTemplates/ShowPageClient";
import AboutClient from "@/components/PageTemplates/AboutClient";
import FormClient from "@/components/PageTemplates/FormClient";
import ProductsClient from "@/components/PageTemplates/ProductsClient";
import SubscribeClient from "@/components/PageTemplates/SubscribeClient";
import StaticPage from "@/components/PageTemplates/StaticPage";
import CheckoutResultClient from "@/components/PageTemplates/CheckoutResultClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DynamicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  if (!pageConfig) return notFound();

  const { format, name } = pageConfig;

  // Per-page CTA: enabled by default, controllable from portal
  const showCta = pageConfig.cta?.enabled !== false;
  const ctaConfig = pageConfig.cta ?? {};

  // Collection list pages — shows/events format
  if (format === "shows") {
    const collectionId = getPageCollectionId(siteData, name, process.env.SHOWS_ID || "");
    const { shows, totalCount } = await getShowsPaginated({ collectionId, limit: 100, skip: 0 });
    const today = new Date();

    const upcomingShows = shows
      .filter((s) => s.date && new Date(s.date) >= today)
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

    const pastShows = shows
      .filter((s) => s.date && new Date(s.date) < today)
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    const labels = {
      title: getPageLabel(siteData, name, "title", "All Content"),
      subtitle: getPageLabel(siteData, name, "subtitle", "Browse our upcoming and past content — events, highlights, and more."),
      upcoming: getPageLabel(siteData, name, "upcoming", "Upcoming"),
      past: getPageLabel(siteData, name, "past", "Past"),
    };

    return (
      <>
        <Navbar />
        <ShowPageClient
          upcomingShows={upcomingShows}
          pastShows={pastShows}
          labels={labels}
          slug={slug}
          collectionId={collectionId}
          totalCount={totalCount}
        />
        {showCta && <CTASection config={ctaConfig} />}
        <Footer />
      </>
    );
  }

  // Collection list pages — team/people format
  if (format === "team") {
    const collectionId = getPageCollectionId(siteData, name, process.env.TEAMMEMBERS_ID || "");
    const teamMembers = await getTeamMembers(collectionId);

    const labels = {
      title: getPageLabel(siteData, name, "title", "Meet the Team"),
      subtitle: getPageLabel(siteData, name, "subtitle", "Behind every great experience is a passionate team. Here's a glimpse of the people who make it possible."),
    };

    return (
      <>
        <Navbar />
        <AboutClient teamMembers={teamMembers} labels={labels} slug={slug} />
        {showCta && <CTASection config={ctaConfig} />}
        <Footer />
      </>
    );
  }

  // Form pages — form/review format
  if (format === "form") {
    const collectionId = getPageCollectionId(siteData, name, "");

    return (
      <>
        <Navbar />
        <FormClient collectionId={collectionId} />
        <Footer />
      </>
    );
  }

  // Product listing pages — products format
  if (format === "products") {
    const resolvedSearchParams = await searchParams;
    const searchVal = resolvedSearchParams?.search as string | undefined;
    const sortVal = resolvedSearchParams?.sort as string | undefined;

    // Parse multi-filter params: f_productType=Bagels&f_priceRange=$10-$20
    const activeFilters: Record<string, string> = {};
    for (const [key, val] of Object.entries(resolvedSearchParams ?? {})) {
      if (key.startsWith("f_") && typeof val === "string" && val) {
        activeFilters[key.slice(2)] = val;
      }
    }

    // Read integration type and filter collection from page config bindings
    const integrationBinding = (pageConfig.integrations ?? []).find(
      (i) => (i.type ?? i.name ?? '').toLowerCase()
    );
    const integrationType = (integrationBinding?.type ?? integrationBinding?.name ?? 'stripe').toLowerCase();
    // Filter collection can be on the integration binding or the page config (legacy)
    const filterCollectionId = (integrationBinding as Record<string, unknown>)?.collectionId as string | undefined
      ?? pageConfig.collectionId
      ?? null;

    const [products, filters] = await Promise.all([
      getProducts({ filters: activeFilters, searchVal, sortVal, integrationType }),
      filterCollectionId ? getFilters(filterCollectionId) : Promise.resolve([]),
    ]);

    return (
      <>
        <Navbar />
        <ProductsClient
          products={products}
          filters={filters}
          labels={pageConfig.labels ?? {}}
          slug={slug}
          detailEnabled={pageConfig.detailPage?.enabled !== false}
          initialFilters={activeFilters}
          initialSort={sortVal}
          initialSearch={searchVal}
        />
        {showCta && <CTASection config={ctaConfig} />}
        <Footer />
      </>
    );
  }

  // Subscribe / newsletter pages
  if (format === "subscribe") {
    return (
      <>
        <Navbar />
        <SubscribeClient
          collectionId={pageConfig.collectionId ?? ""}
          labels={pageConfig.labels ?? {}}
        />
        {showCta && <CTASection config={ctaConfig} />}
        <Footer />
      </>
    );
  }

  // Checkout result pages — success/cancel after Stripe checkout
  if (format === "checkout-success" || format === "checkout-cancel") {
    return (
      <>
        <Navbar />
        <CheckoutResultClient success={format === "checkout-success"} />
        <Footer />
      </>
    );
  }

  // Static pages — privacy, terms, etc.
  if (format === "static") {
    const labels = {
      title: getPageLabel(siteData, name, "title", name),
      content: getPageLabel(siteData, name, "content", ""),
    };

    return (
      <>
        <Navbar />
        <StaticPage labels={labels} pageName={name} />
        {showCta && <CTASection config={ctaConfig} />}
        <Footer />
      </>
    );
  }

  return notFound();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";

  if (!pageConfig) {
    return { title: `Not Found | ${siteName}` };
  }

  const title = pageConfig.labels?.title || pageConfig.name;

  return {
    title: `${title} | ${siteName}`,
    description: pageConfig.labels?.subtitle || `${title} — ${siteName}`,
  };
}
