import { notFound } from 'next/navigation';
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import type {
  DetailItem,
  DetailPageConfig as RendererDetailPageConfig,
  DetailSupplementalData,
  DetailTikTokEmbed,
  SiteData as RendererSiteData,
} from '@hillbombcreations/site-renderer';
import DetailPageClient from './DetailPageClient';
import { getSiteData, getPageCollectionId } from '@/lib/api/siteData';
import { getPageBySlug } from '@/lib/pages';
import { getShowById } from '@/lib/api/shows';
import { getTeamMembers } from '@/lib/api/team';
import { getTikTokPosts, getTikTokOEmbed } from '@/lib/api/social';
import { getProductById } from '@/lib/api/products';
import { getIntegrationItems } from '@/lib/api/collections';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

interface Props {
  params: Promise<{ slug: string; itemId: string }>;
}

export default async function DynamicItemPage({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  if (!pageConfig) return notFound();
  if (pageConfig.detailPage?.enabled === false) return notFound();

  const format = pageConfig.format;

  /* ---- format-specific item fetch ---- */

  let item: DetailItem | null = null;
  let socialEmbeds: DetailTikTokEmbed[] = [];
  let supplementalFeeds: DetailSupplementalData[] = [];

  if (format === 'shows') {
    const collectionId = getPageCollectionId(
      siteData,
      pageConfig.name,
      process.env.SHOWS_ID || '',
    );
    const show = await getShowById(itemId, collectionId);
    if (!show) return notFound();
    item = show as unknown as DetailItem;
  } else if (format === 'team') {
    const collectionId = getPageCollectionId(
      siteData,
      pageConfig.name,
      process.env.TEAMMEMBERS_ID || '',
    );
    const teamMembers = await getTeamMembers(collectionId);
    const member = teamMembers.find((m) => m.id === itemId);
    if (!member) return notFound();
    item = member as unknown as DetailItem;

    const tiktokHandle = member.socialLinks?.tiktok;
    if (tiktokHandle) {
      const allPosts = await getTikTokPosts();
      const handle = tiktokHandle.replace(/^@/, '');
      const memberPosts = allPosts.filter(
        (p) => p.permalink && p.permalink.includes(handle),
      );
      socialEmbeds = await Promise.all(
        memberPosts.slice(0, 6).map(async (post) => ({
          caption: post.caption,
          permalink: post.permalink!,
          html: post.permalink
            ? ((await getTikTokOEmbed(post.permalink))?.html ?? null)
            : null,
        })),
      );
    }
  } else if (format === 'products') {
    const product = await getProductById(itemId);
    if (!product) return notFound();
    item = product as unknown as DetailItem;

    // Pre-fetch supplemental integrations for the detail page (non-Stripe).
    const detailIntegrations = (pageConfig.detailPage?.integrations ?? []).filter(
      (i) => (i.type ?? i.name ?? '').toLowerCase() !== 'stripe',
    );
    supplementalFeeds = await Promise.all(
      detailIntegrations.map(async (binding) => {
        const type = (binding.type ?? binding.name ?? '').toLowerCase();
        const { items } = await getIntegrationItems(type, { limit: 10 });
        return { items, displayAs: binding.displayAs ?? 'feed', type };
      }),
    );
  } else {
    return notFound();
  }

  const detailPageCfg = pageConfig.detailPage as RendererDetailPageConfig | undefined;

  return (
    <>
      <Navbar />
      <DetailPageClient
        slug={slug}
        item={item!}
        format={format}
        cta={pageConfig.cta}
        detailPage={detailPageCfg}
        siteData={siteData as unknown as RendererSiteData}
        socialEmbeds={socialEmbeds}
        supplementalFeeds={supplementalFeeds}
      />
      <Footer />
    </>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  if (!pageConfig) {
    return { title: `Not Found | ${siteName}` };
  }

  if (pageConfig.format === 'shows') {
    const collectionId = getPageCollectionId(
      siteData,
      pageConfig.name,
      process.env.SHOWS_ID || '',
    );
    const show = await getShowById(itemId, collectionId);
    if (!show) {
      return { title: `Not found | ${siteName}` };
    }
    const domain = siteData?.domainName || '';
    return {
      title: `${show.title} | ${siteName}`,
      description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
      ...(domain && {
        openGraph: {
          title: show.title,
          description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
          url: `https://${domain}/${slug}/${itemId}`,
          images: show.imageUrl
            ? [{ url: show.imageUrl, width: 1200, height: 630, alt: show.title }]
            : [],
          type: 'article',
        },
        twitter: {
          card: 'summary_large_image',
          title: show.title,
          description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
          images: show.imageUrl ? [show.imageUrl] : [],
        },
      }),
    };
  }

  if (pageConfig.format === 'team') {
    const teamMembers = await getTeamMembers();
    const member = teamMembers.find((m) => m.id === itemId);
    return {
      title: member ? `${member.name} | ${siteName}` : `Team Member | ${siteName}`,
      description: member
        ? `Learn more about ${member.name} at ${siteName}.`
        : `Team member at ${siteName}.`,
    };
  }

  return { title: `${pageConfig.name} | ${siteName}` };
}
