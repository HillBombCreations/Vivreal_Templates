import { notFound } from "next/navigation";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import { CTASectionTemplate, MenuPage } from "@/components/RendererExports";
import type {
  SiteData as RendererSiteData,
  MenuCategory,
  MenuItem,
} from "@hillbombcreations/site-renderer";
import { getSiteData, getPageLabel } from "@/lib/api/siteData";
import { getPageBySlug } from "@/lib/pages";
import { getPageData } from "@/lib/api/pageData";
import ContentRenderer from "@/components/ContentRenderer";
import PageShell from "@/components/PageShell";
import { getCollectionItems } from "@/lib/api/collections";
// CC8 Phase 4: FormClient is no longer routed (form pages compose through the
// renderer FormLayout/ConfigurableForm via composePage). Import removed; the
// component file is retained until it is retired post-dogfood validation.
import SubscribeClient from "@/components/PageTemplates/SubscribeClient";
import { composePage } from "@hillbombcreations/site-renderer";
import { buildPageContext } from "@/lib/api/composition/buildPageContext";
import ProductsPageComposed from "@/components/PageTemplates/ProductsPageComposed";
import type { PageConfig } from "@/types/SiteData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Formats migrated to the unified composePage() pipeline (Plan 4). Migrated one
// at a time, parity-gated; any format NOT listed here keeps the legacy per-format
// JSX below. The live site and the Studio preview both render listed formats
// through the same composePage(), so they can no longer drift.
const COMPOSE_FORMATS = new Set<string>([
  "static",
  "shows",
  "team",
  "checkout-success",
  "checkout-cancel",
  "products",
  "schedule",
  // CC8 Phase 4: route form/review pages through composePage → renderer
  // FormLayout/ConfigurableForm so live == Studio preview (WYSIWYG). The
  // renderer reads the section's submitMode/collectionId + rating config to
  // render review-mode (rating input + POST to /api/review). A form page with
  // no submitMode (no CC8 backfill yet) composes to the legacy contact form
  // (email path) — graceful degradation, not a crash. See FormClient (retired).
  "form",
]);
function composeFormat(format: string | undefined): format is string {
  return format !== undefined && COMPOSE_FORMATS.has(format);
}

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

  // Privacy and terms always render on every site, even if not in page config
  const STATIC_SLUGS: Record<string, string> = {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
  };
  if (!pageConfig && !STATIC_SLUGS[slug]) return notFound();

  const format = pageConfig?.format ?? (STATIC_SLUGS[slug] ? "static" : undefined);
  const name = pageConfig?.name ?? STATIC_SLUGS[slug] ?? slug;

  // Composed formats (Plan 4) — render through the same composePage() the Studio
  // preview uses. Handled first so static can render with pageConfig undefined
  // (privacy/terms always exist even without a portal page config).
  if (composeFormat(format)) {
    let composedPage: PageConfig;
    if (format === "static") {
      // Static (privacy/terms): resolve labels via getPageLabel exactly as the
      // legacy StaticPage did, and synthesize a config for the slug-only
      // privacy/terms pages that have no portal page config. composePage's static
      // branch keys default copy off page.slug and emits the trailing CTA band.
      const labels: Record<string, string> = {
        title: getPageLabel(siteData, name, "title", name),
        content: getPageLabel(siteData, name, "content", ""),
      };
      composedPage = pageConfig
        ? { ...pageConfig, labels }
        : { name, slug, format, collectionId: null, labels };
    } else {
      // Other composed formats (shows, team, products, checkout) always have a
      // portal page config (reached before the !pageConfig notFound guard below).
      // Pass it straight through — composePage owns their label defaults + shaping.
      composedPage = pageConfig!;
    }

    // Products controlled query: parse f_<key>/search/sort from the URL so the
    // builder filters server-side (VR_Client_API), and inject the live,
    // router+cart-wired ProductsPage via the B1 component override. composePage
    // renders the bare uncontrolled ProductsPage for the Studio preview.
    let productQuery:
      | { filters?: Record<string, string>; search?: string; sort?: string }
      | undefined;
    let components: { ProductsPage: typeof ProductsPageComposed } | undefined;
    if (format === "products") {
      const sp = (await searchParams) ?? {};
      const filters: Record<string, string> = {};
      for (const [key, val] of Object.entries(sp)) {
        if (key.startsWith("f_") && typeof val === "string" && val) {
          filters[key.slice(2)] = val;
        }
      }
      productQuery = {
        filters,
        search: typeof sp.search === "string" ? sp.search : undefined,
        sort: typeof sp.sort === "string" ? sp.sort : undefined,
      };
      components = { ProductsPage: ProductsPageComposed };
    }

    const { input } = await buildPageContext({
      siteData,
      page: composedPage,
      isHome: false,
      productQuery,
    });

    return (
      <>
        <Navbar />
        {composePage(
          components
            ? { ...input, options: { ...input.options!, components } }
            : input,
        )}
        <Footer />
      </>
    );
  }

  // Beyond this point pageConfig is always defined (non-static formats require a page config)
  if (!pageConfig) return notFound();

  // Per-page CTA: enabled by default, controllable from portal
  const showCta = pageConfig.cta?.enabled !== false;
  const ctaConfig = pageConfig.cta ?? {};

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

  // CC8 Phase 4: form/review pages are now composed (see COMPOSE_FORMATS +
  // the composeFormat() block above). The legacy <FormClient> branch is removed
  // from the routing path here; FormClient itself is retired in a SEPARATE
  // commit after dogfood validation (publish-gate phasing). No fallback cycle.

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
                <ContentRenderer key={i} items={s.items} displayAs={s.displayAs} slug={slug} detailEnabled={detailEnabled} sectionConfig={s.sectionConfig} />
              ))}</>
            : undefined
        }
        supplemental={
          pageData.supplemental.length > 0
            ? <>{pageData.supplemental.map((s, i) => (
                <ContentRenderer key={i} items={s.items} displayAs={s.displayAs} slug={slug} detailEnabled={detailEnabled} sectionConfig={s.sectionConfig} />
              ))}</>
            : undefined
        }
      >
        {[...pageData.primary, ...pageData.secondary].map((section, i) => (
          <ContentRenderer key={i} items={section.items} displayAs={section.displayAs} slug={slug} detailEnabled={detailEnabled} sectionConfig={section.sectionConfig} />
        ))}
      </PageShell>
      {showCta && <CTASectionTemplate config={ctaConfig} siteData={siteData as unknown as RendererSiteData} />}
      <Footer />
    </>
  );
}

const STATIC_PAGE_TITLES: Record<string, string> = {
  privacy: "Privacy Policy",
  terms: "Terms of Service",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";

  if (!pageConfig && !STATIC_PAGE_TITLES[slug]) {
    return { title: `Not Found | ${siteName}` };
  }

  const title = pageConfig?.labels?.title || pageConfig?.name || STATIC_PAGE_TITLES[slug];

  return {
    title: `${title} | ${siteName}`,
    description: pageConfig?.labels?.subtitle || `${title} — ${siteName}`,
  };
}
