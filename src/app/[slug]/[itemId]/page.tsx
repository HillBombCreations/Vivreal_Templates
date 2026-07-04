import { notFound } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import { CTASectionTemplate } from "@/components/RendererExports";
import { DetailPageTemplate } from "@hillbombcreations/site-renderer";
import type { SiteData as RendererSiteData } from "@hillbombcreations/site-renderer";
import { ArrowLeft } from "lucide-react";
import { getSiteData, getPageCollectionId } from "@/lib/api/siteData";
import { resolveSiteOrigin, buildOgImageUrl } from "@/lib/og/ogImage";
import { getPageBySlug } from "@/lib/pages";
import { getShowById } from "@/lib/api/shows";
import { getTeamMembers } from "@/lib/api/team";
import { getTikTokPosts, getTikTokOEmbed } from "@/lib/api/social";
import { getProductById } from "@/lib/api/products";
import { getIntegrationItems } from "@/lib/api/collections";
import { renderComposedPage } from "@/lib/renderComposedPage";
import ProductDetailRenderer from "@/components/PageTemplates/ProductDetailRenderer";
import ContentRenderer from "@/components/ContentRenderer";
import type {
  DetailItem,
  DetailPageConfig,
  DetailSection,
  PageCtaConfig as RendererPageCtaConfig,
} from "@hillbombcreations/site-renderer";
import { JsonLd, buildDetailJsonLd } from "@/components/JsonLd";
import { unsignMediaUrl } from "@/components/JsonLd/unsignMediaUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string; itemId: string }>;
}

export default async function DynamicItemPage({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  // CP-11: Resolve depth-2 nested sub-pages (e.g. /features/ai-sites) that the
  // migrator emits as pageConfig.slug="features/ai-sites". Next.js matches the
  // URL as [slug]="features" / [itemId]="ai-sites". Join the two segments and
  // check against pageConfigs BEFORE the single-segment !pageConfig guard.
  //
  // Disambiguation guarantee: collection items (blog posts, shows, products, team
  // members) are NEVER stored as pageConfigs, so getPageBySlug(siteData,
  // "blog/<post>") always returns undefined and the existing detail-item logic
  // below runs unchanged.
  const nestedSlug = `${slug}/${itemId}`;
  const nestedPage = getPageBySlug(siteData, nestedSlug);
  if (nestedPage) {
    // Defensive guard: interactive/collection formats never appear as nested page
    // configs. If one somehow does, return notFound() rather than misrender.
    const NON_NESTABLE_FORMATS = new Set([
      "products", "schedule", "menu", "subscribe",
      "checkout-success", "checkout-cancel", "home", "shows", "team",
    ]);
    if (NON_NESTABLE_FORMATS.has(nestedPage.format)) return notFound();
    return renderComposedPage({ siteData, composedPage: nestedPage });
  }

  if (!pageConfig) return notFound();

  // Guard: if detail pages are explicitly disabled for this page, return 404
  if (pageConfig.detailPage?.enabled === false) return notFound();

  // Show/event detail
  if (pageConfig.format === "shows") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.SHOWS_ID || "");
    const show = await getShowById(itemId, collectionId);

    if (!show) {
      return (
        <>
          <Navbar />
          <main className="pt-24 md:pt-32 pb-20 md:pb-32 text-center">
            <h1 className="text-3xl font-bold">Not found</h1>
            <p className="mt-4 text-gray-800">
              Sorry, we couldn&apos;t find the content you&apos;re looking for.
            </p>
            <Link
              href={`/${slug}`}
              className="inline-flex items-center gap-1 mt-6 text-primary hover:underline"
            >
              <ArrowLeft size={16} /> Back to all content
            </Link>
          </main>
          <Footer />
        </>
      );
    }

    const showStartDate =
      show.date && show.time
        ? `${show.date}T${show.time}`
        : show.date || undefined;
    const showJsonLd = buildDetailJsonLd({
      format: 'shows',
      title: show.title,
      description: show.description?.replace(/<[^>]*>/g, '').slice(0, 500),
      // Strip CloudFront signing params before embedding in long-lived JSON-LD
      // (crawler caches outlive the 300s signed-URL TTL) — same treatment the
      // team branch already applies to member images.
      imageUrl: unsignMediaUrl(show.imageUrl || show.image || undefined),
      url: siteData.domainName
        ? `https://${siteData.domainName}/${slug}/${itemId}`
        : undefined,
      startDate: showStartDate,
      location: show.location || undefined,
    });

    return (
      <>
        <JsonLd schema={showJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format="shows"
          item={show as unknown as DetailItem}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={pageConfig.detailPage as DetailPageConfig | undefined}
        />
        <Footer />
      </>
    );
  }

  // Team member detail
  if (pageConfig.format === "team") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.TEAMMEMBERS_ID || "");
    const teamMembers = await getTeamMembers(collectionId);
    const member = teamMembers.find((m) => m.id === itemId);

    if (!member) return notFound();

    // Fetch TikTok posts and match by handle
    const tiktokHandle = member.socialLinks?.tiktok;
    let tiktokEmbeds: { caption: string; permalink: string; html: string | null }[] = [];

    if (tiktokHandle) {
      const allPosts = await getTikTokPosts();
      const handle = tiktokHandle.replace(/^@/, "");
      const memberPosts = allPosts.filter(
        (p) => p.permalink && p.permalink.includes(handle)
      );

      tiktokEmbeds = await Promise.all(
        memberPosts.slice(0, 6).map(async (post) => ({
          caption: post.caption,
          permalink: post.permalink!,
          html: post.permalink
            ? ((await getTikTokOEmbed(post.permalink))?.html ?? null)
            : null,
        }))
      );
    }

    // Strip CloudFront signing params before embedding in JSON-LD; signed
    // URLs expire after 300s but JSON-LD lives in crawler caches for days.
    // See @/components/JsonLd/unsignMediaUrl.ts for the full rationale.
    const memberImage = unsignMediaUrl(member.imageUrl || member.image || undefined);
    const memberJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: member.name,
      ...(member.description
        ? { description: member.description.replace(/<[^>]*>/g, '').slice(0, 500) }
        : {}),
      ...(memberImage ? { image: memberImage } : {}),
      ...(siteData.domainName
        ? { url: `https://${siteData.domainName}/${slug}/${itemId}` }
        : {}),
      ...(siteData.businessInfo?.name
        ? {
            worksFor: {
              '@type': 'Organization',
              name: siteData.businessInfo.name,
            },
          }
        : {}),
    };

    return (
      <>
        <JsonLd schema={memberJsonLd} />
        <Navbar />
        <DetailPageTemplate
          slug={slug}
          format="team"
          item={member as unknown as DetailItem}
          socialEmbeds={tiktokEmbeds}
          siteData={siteData as unknown as RendererSiteData}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
          detailPage={pageConfig.detailPage as DetailPageConfig | undefined}
        />
        <Footer />
      </>
    );
  }

  // Product detail
  if (pageConfig.format === "products") {
    const product = await getProductById(itemId);
    if (!product) return notFound();

    // Fetch supplemental integrations for the detail page (non-Stripe ones)
    const detailIntegrations = (pageConfig.detailPage?.integrations ?? [])
      .filter(i => (i.type ?? i.name ?? '').toLowerCase() !== 'stripe');

    const detailSupplemental = await Promise.all(
      detailIntegrations.map(async (binding) => {
        const type = (binding.type ?? binding.name ?? '').toLowerCase();
        const { items } = await getIntegrationItems(type, { limit: 10 });
        return { items, displayAs: binding.displayAs ?? 'feed', type };
      })
    );

    // Product JSON-LD: only emit Product schema when name/price/image are
    // plain strings (not variant maps) — otherwise we'd need to pick a
    // default variant, which is a renderer-level concern. Fall back to
    // the generic detail JSON-LD (Thing) when variant-keyed.
    const productName =
      typeof product.name === 'string' ? product.name : undefined;
    const productPrice =
      typeof product.price === 'string' ? product.price : undefined;
    const productImage =
      typeof product.imageUrl === 'string' ? product.imageUrl : undefined;
    const productDescription =
      typeof product.description === 'string'
        ? product.description.replace(/<[^>]*>/g, '').slice(0, 500)
        : undefined;

    const productJsonLd = buildDetailJsonLd({
      format: 'products',
      title: productName || 'Product',
      description: productDescription,
      imageUrl: productImage,
      url: siteData.domainName
        ? `https://${siteData.domainName}/${slug}/${itemId}`
        : undefined,
      price: productPrice,
      sku: product._id,
    });

    // Build the renderer detail config. The route already renders supplemental
    // integrations + CTA in its own blocks below, so scope the renderer's
    // sections to the buy box (hero/variants/addToCart/content) to avoid
    // double-rendering. Honor any explicitly-configured sections by filtering
    // out the route-owned ones.
    const ROUTE_OWNED_SECTIONS = new Set<DetailSection>([
      "supplementalIntegrations",
      "related",
      "cta",
    ]);
    // The runtime `detailPage` may carry v0.4.0 fields (sections, heroVariant,
    // etc.) the Templates `PageConfig` type doesn't declare — view it through
    // the renderer's config type to read them safely.
    const existingDetailPage = pageConfig.detailPage as DetailPageConfig | undefined;
    const configuredSections = existingDetailPage?.sections;
    const buyBoxSections: DetailSection[] = (configuredSections ?? [
      "hero",
      "variants",
      "addToCart",
      "content",
    ]).filter((s) => !ROUTE_OWNED_SECTIONS.has(s));

    const rendererDetailPage: DetailPageConfig = {
      ...existingDetailPage,
      sections: buyBoxSections,
    };

    return (
      <>
        <JsonLd schema={productJsonLd} />
        <Navbar />
        <ProductDetailRenderer
          product={product}
          siteData={siteData}
          slug={slug}
          detailPage={rendererDetailPage}
          cta={pageConfig.cta as RendererPageCtaConfig | undefined}
        />
        {detailSupplemental.length > 0 && (
          <div className="content-grid py-8">
            {detailSupplemental.map((section, i) => (
              <div key={i} className="mb-8">
                <h3 className="text-lg font-semibold mb-4 capitalize" style={{ color: 'var(--text-primary)' }}>
                  {section.type}
                </h3>
                <ContentRenderer
                  items={section.items}
                  displayAs={section.displayAs}
                  slug={slug}
                />
              </div>
            ))}
          </div>
        )}
        <CTASectionTemplate siteData={siteData as unknown as RendererSiteData} />
        <Footer />
      </>
    );
  }

  return notFound();
}

export async function generateMetadata({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  const origin = resolveSiteOrigin(siteData);

  // CP-11: metadata for nested sub-pages resolved via the joined slug.
  const nestedPage = getPageBySlug(siteData, `${slug}/${itemId}`);
  if (nestedPage) {
    const seo = nestedPage.seo;
    const derived = nestedPage.labels?.title || nestedPage.name;
    const title = seo?.metaTitle || `${derived} | ${siteName}`;
    const description =
      seo?.metaDescription || nestedPage.labels?.subtitle || `${derived} — ${siteName}`;
    // OG route is a single dynamic segment; use the first URL segment so it
    // always resolves (nested pages fall back to the site card).
    const ogImageUrl = buildOgImageUrl(origin, slug);
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${origin}/${slug}/${itemId}`,
        type: "website",
        siteName,
        images: [ogImageUrl],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  }

  const pageConfig = getPageBySlug(siteData, slug);

  if (!pageConfig) {
    return { title: `Not Found | ${siteName}` };
  }

  // Detail items inherit the parent page's Studio SEO text + OG image. The OG
  // image points at the stable `/og/[slug]` route (which proxies the page's
  // uploaded image, else a branded card) rather than the item's own media URL:
  // item media is a CloudFront-signed URL that 403s after the 300s signature TTL
  // (the pre-existing bug this replaces). The OG route re-signs on every request,
  // so its URL never expires in crawler caches.
  const seo = pageConfig.seo;
  const ogImageUrl = buildOgImageUrl(origin, slug);
  const itemUrl = `${origin}/${slug}/${itemId}`;

  if (pageConfig.format === "shows") {
    const collectionId = getPageCollectionId(siteData, pageConfig.name, process.env.SHOWS_ID || "");
    const show = await getShowById(itemId, collectionId);
    if (!show) {
      return { title: `Not found | ${siteName}` };
    }
    const cleanDesc = show.description?.replace(/<[^>]*>/g, "").slice(0, 160);
    const title = seo?.metaTitle || `${show.title} | ${siteName}`;
    const description = seo?.metaDescription || cleanDesc || `${show.title} — ${siteName}`;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: itemUrl,
        type: "article",
        siteName,
        images: [ogImageUrl],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  }

  if (pageConfig.format === "team") {
    const teamMembers = await getTeamMembers();
    const member = teamMembers.find((m) => m.id === itemId);
    const name = member?.name;
    const title =
      seo?.metaTitle || (name ? `${name} | ${siteName}` : `Team Member | ${siteName}`);
    const description =
      seo?.metaDescription ||
      (name ? `Learn more about ${name} at ${siteName}.` : `Team member at ${siteName}.`);
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: itemUrl,
        type: "article",
        siteName,
        images: [ogImageUrl],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImageUrl],
      },
    };
  }

  // Products + any other item detail. Kept lightweight (no per-item fetch): the
  // section name is the sensible default title. `seo` still overrides.
  const title = seo?.metaTitle || `${pageConfig.name} | ${siteName}`;
  const description =
    seo?.metaDescription || pageConfig.labels?.subtitle || `${pageConfig.name} — ${siteName}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: itemUrl,
      type: "article",
      siteName,
      images: [ogImageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
