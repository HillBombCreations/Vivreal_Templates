import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import { CTASectionTemplate, TeamPage, MenuPage } from "@/components/RendererExports";
import type {
  SiteData as RendererSiteData,
  TeamMemberData,
  MenuCategory,
  MenuItem,
} from "@hillbombcreations/site-renderer";
import { getSiteData, getPageLabel, getPageCollectionId } from "@/lib/api/siteData";
import { getPageBySlug } from "@/lib/pages";
import { getPageData } from "@/lib/api/pageData";
import ContentRenderer from "@/components/ContentRenderer";
import PageShell from "@/components/PageShell";
import { getShowsPaginated } from "@/lib/api/shows";
import { getTeamMembers } from "@/lib/api/team";
import { getProducts, getFilters } from "@/lib/api/products";
import { getCollectionItems, getIntegrationItems } from "@/lib/api/collections";
import ShowsPageWrapper from "@/components/PageTemplates/ShowsPageWrapper";
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
    const showsBinding = (pageConfig.collections ?? [])[0];
    const showsDisplayAs = showsBinding?.displayAs;

    if (showsDisplayAs && showsDisplayAs !== 'cards') {
      const collectionId = getPageCollectionId(siteData, name, process.env.SHOWS_ID || "");
      const { items } = await getCollectionItems(collectionId);
      return (
        <>
          <Navbar />
          <PageShell title={pageConfig.labels?.title} subtitle={pageConfig.labels?.subtitle}>
            <ContentRenderer items={items} displayAs={showsDisplayAs} slug={slug} detailEnabled={pageConfig.detailPage?.enabled !== false} />
          </PageShell>
          {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
          <Footer />
        </>
      );
    }

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
        <ShowsPageWrapper
          upcomingShows={upcomingShows}
          initialPastShows={pastShows}
          labels={labels}
          slug={slug}
          siteData={siteData as unknown as RendererSiteData}
          collectionId={collectionId}
          totalCount={totalCount}
        />
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
        <Footer />
      </>
    );
  }

  // Collection list pages — team/people format
  if (format === "team") {
    const teamBinding = (pageConfig.collections ?? [])[0];
    const teamDisplayAs = teamBinding?.displayAs;

    if (teamDisplayAs && teamDisplayAs !== 'cards') {
      const collectionId = getPageCollectionId(siteData, name, process.env.TEAMMEMBERS_ID || "");
      const { items } = await getCollectionItems(collectionId);
      return (
        <>
          <Navbar />
          <PageShell title={pageConfig.labels?.title} subtitle={pageConfig.labels?.subtitle}>
            <ContentRenderer items={items} displayAs={teamDisplayAs} slug={slug} detailEnabled={pageConfig.detailPage?.enabled !== false} />
          </PageShell>
          {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
          <Footer />
        </>
      );
    }

    const collectionId = getPageCollectionId(siteData, name, process.env.TEAMMEMBERS_ID || "");
    const teamMembers = await getTeamMembers(collectionId);

    const labels = {
      title: getPageLabel(siteData, name, "title", "Meet the Team"),
      subtitle: getPageLabel(siteData, name, "subtitle", "Behind every great experience is a passionate team. Here's a glimpse of the people who make it possible."),
    };

    return (
      <>
        <Navbar />
        <TeamPage
          members={teamMembers as TeamMemberData[]}
          labels={labels}
          slug={slug}
          siteData={siteData as unknown as RendererSiteData}
        />
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
        <Footer />
      </>
    );
  }

  // Restaurant menu pages — menu format (Iter 5)
  // Convention: first collection binding is Menu Categories (filter nav),
  // second binding is Menu Items (the dishes). Matches the restaurant
  // blueprint seeded by VR_Secure_API.buildRestaurantPages.
  if (format === "menu") {
    const bindings = pageConfig.collections ?? [];
    // Find by role or name — primary binding = items, supplemental = categories.
    const categoriesBinding = bindings.find(
      (b) => (b.name ?? '').toLowerCase().includes('categor'),
    ) ?? bindings[0];
    const itemsBinding = bindings.find(
      (b) => (b.name ?? '').toLowerCase().includes('item'),
    ) ?? bindings[bindings.length - 1];

    const categoriesCollectionId = categoriesBinding?.collectionId || '';
    const itemsCollectionId = itemsBinding?.collectionId || '';

    const [categoriesRes, itemsRes] = await Promise.all([
      categoriesCollectionId
        ? getCollectionItems(categoriesCollectionId)
        : Promise.resolve({ items: [], totalCount: 0 }),
      itemsCollectionId
        ? getCollectionItems(itemsCollectionId)
        : Promise.resolve({ items: [], totalCount: 0 }),
    ]);

    // Map raw ContentItems to the MenuPage shape. Keep the mapping narrow —
    // the renderer doesn't know about CMS internals.
    const categories: MenuCategory[] = categoriesRes.items.map((raw, idx) => {
      const r = raw as unknown as Record<string, unknown>;
      return {
        id: typeof r.id === 'string' ? r.id : `cat-${idx}`,
        name: typeof r.name === 'string' ? r.name : `Category ${idx + 1}`,
        order: typeof r.order === 'number' ? r.order : idx,
        icon: typeof r.icon === 'string' ? r.icon : undefined,
        description: typeof r.description === 'string' ? r.description : undefined,
      };
    });

    const items: MenuItem[] = itemsRes.items.map((raw, idx) => {
      const r = raw as unknown as Record<string, unknown>;
      const dietary = Array.isArray(r.dietaryTags)
        ? (r.dietaryTags as unknown[]).filter((t): t is string => typeof t === 'string')
        : undefined;
      return {
        id: typeof r.id === 'string' ? r.id : `item-${idx}`,
        name: typeof r.name === 'string' ? r.name : 'Untitled',
        description: typeof r.description === 'string' ? r.description : undefined,
        price: typeof r.price === 'number' ? r.price : undefined,
        priceDisplay: typeof r.priceDisplay === 'string' ? r.priceDisplay : undefined,
        category: typeof r.category === 'string' ? r.category : undefined,
        dietaryTags: dietary,
      };
    });

    return (
      <>
        <Navbar />
        <MenuPage
          categories={categories}
          items={items}
          title={pageConfig.labels?.title as string | undefined}
          subtitle={pageConfig.labels?.subtitle as string | undefined}
        />
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
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
    // Read integration type and displayAs from page config bindings
    const integrationBinding = (pageConfig.integrations ?? []).find(
      (i) => (i.type ?? i.name ?? '').toLowerCase()
    );
    const integrationType = (integrationBinding?.type ?? integrationBinding?.name ?? 'stripe').toLowerCase();
    const productsDisplayAs = integrationBinding?.displayAs ?? 'cards';

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
    // Filter collection: page-level collectionId holds the filter definitions,
    // integration binding collectionId identifies the product collection (not filters)
    const filterCollectionId = pageConfig.collectionId
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
          displayAs={productsDisplayAs}
          detailEnabled={pageConfig.detailPage?.enabled !== false}
          initialFilters={activeFilters}
          initialSort={sortVal}
          initialSearch={searchVal}
        />
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
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
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
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
        {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
        <Footer />
      </>
    );
  }

  // Generic binding-driven pages (list, grid, standard, or any custom format)
  const pageData = await getPageData(pageConfig);
  const detailEnabled = pageConfig.detailPage?.enabled !== false;
  const hasAnyContent = [...pageData.primary, ...pageData.secondary, ...pageData.supplemental, ...pageData.sidebar].some(s => s.items.length > 0);

  if (!hasAnyContent) return notFound();

  return (
    <>
      <Navbar />
      <PageShell
        title={pageConfig.labels?.title}
        subtitle={pageConfig.labels?.subtitle}
        sidebar={
          pageData.sidebar.length > 0
            ? <>{pageData.sidebar.map((s, i) => (
                <ContentRenderer key={i} items={s.items} displayAs={s.displayAs} slug={slug} detailEnabled={detailEnabled} />
              ))}</>
            : undefined
        }
        supplemental={
          pageData.supplemental.length > 0
            ? <>{pageData.supplemental.map((s, i) => (
                <ContentRenderer key={i} items={s.items} displayAs={s.displayAs} slug={slug} detailEnabled={detailEnabled} />
              ))}</>
            : undefined
        }
      >
        {[...pageData.primary, ...pageData.secondary].map((section, i) => (
          <ContentRenderer key={i} items={section.items} displayAs={section.displayAs} slug={slug} detailEnabled={detailEnabled} />
        ))}
      </PageShell>
      {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
      <Footer />
    </>
  );
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
