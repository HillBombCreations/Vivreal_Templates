import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { getSiteData, getPageCollectionId } from "@/lib/api/siteData";
import { getPageBySlug } from "@/lib/pages";
import { getShowById } from "@/lib/api/shows";
import { getTeamMembers } from "@/lib/api/team";
import { getTikTokPosts, getTikTokOEmbed } from "@/lib/api/social";
import { getProductById } from "@/lib/api/products";
import MemberDetail from "@/components/PageTemplates/MemberDetail";
import ProductDetailClient from "@/components/PageTemplates/ProductDetailClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

interface Props {
  params: Promise<{ slug: string; itemId: string }>;
}

export default async function DynamicItemPage({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);

  if (!pageConfig) return notFound();

  const primary = siteData?.primary || "#000000";

  // Show/event detail
  if (pageConfig.format === "shows") {
    const show = await getShowById(itemId);

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

    return (
      <>
        <Navbar />
        <main className="pt-24 md:pt-32 pb-20 md:pb-32 max-w-6xl mx-auto px-4 prose prose-primary prose-headings:font-display prose-headings:font-bold animate-fade-in">
          <Link
            href={`/${slug}`}
            className="inline-flex items-center gap-1 mb-8 hover:underline"
            style={{ color: primary }}
          >
            <ArrowLeft size={16} /> All content
          </Link>

          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
            {show.title}
          </h1>

          <div className="text-gray-600 text-sm mb-6 flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              {show.date && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} />
                  {new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(new Date(show.date))}
                  {show.time ? ` at ${show.time}` : ""}
                </span>
              )}
              {show.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={14} />
                  {show.location}
                </span>
              )}
            </div>
            {show.ticketsUrl &&
              (!show.date || new Date(show.date) >= new Date()) && (
                <a
                  href={show.ticketsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors hover:opacity-90"
                  style={{ backgroundColor: primary }}
                >
                  Get Tickets
                </a>
              )}
          </div>

          {(show.imageUrl || show.image) && show.description ? (
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-1/2 flex-shrink-0">
                <Image
                  src={show.imageUrl || show.image || "/logo.png"}
                  alt={show.title || "Content image"}
                  width={800}
                  height={400}
                  priority
                  className="w-full h-auto rounded-2xl object-cover shadow-sm"
                />
              </div>
              <div className="text-lg">
                <div dangerouslySetInnerHTML={{ __html: show.description }} />
              </div>
            </div>
          ) : (
            <>
              {(show.imageUrl || show.image) && (
                <div className="max-w-2xl">
                  <Image
                    src={show.imageUrl || show.image || "/logo.png"}
                    alt={show.title || "Content image"}
                    width={800}
                    height={400}
                    priority
                    className="w-full h-auto rounded-2xl object-cover shadow-sm"
                  />
                </div>
              )}
              {show.description && (
                <div className="text-lg mt-6">
                  <div dangerouslySetInnerHTML={{ __html: show.description }} />
                </div>
              )}
            </>
          )}
        </main>
        <CTASection />
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

    return (
      <>
        <Navbar />
        <MemberDetail
          member={member}
          siteData={siteData}
          tiktokEmbeds={tiktokEmbeds}
          backSlug={slug}
        />
        <Footer />
      </>
    );
  }

  // Product detail
  if (pageConfig.format === "products") {
    const product = await getProductById(itemId);
    if (!product) return notFound();

    return (
      <>
        <Navbar />
        <ProductDetailClient product={product} siteData={siteData} />
        <CTASection />
        <Footer />
      </>
    );
  }

  return notFound();
}

export async function generateMetadata({ params }: Props) {
  const { slug, itemId } = await params;
  const siteData = await getSiteData();
  const pageConfig = getPageBySlug(siteData, slug);
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";

  if (!pageConfig) {
    return { title: `Not Found | ${siteName}` };
  }

  if (pageConfig.format === "shows") {
    const show = await getShowById(itemId);
    if (!show) {
      return { title: `Not found | ${siteName}` };
    }
    const domain = siteData?.domainName || "";
    return {
      title: `${show.title} | ${siteName}`,
      description: show.description?.replace(/<[^>]*>/g, "").slice(0, 160),
      ...(domain && {
        openGraph: {
          title: show.title,
          description: show.description?.replace(/<[^>]*>/g, "").slice(0, 160),
          url: `https://${domain}/${slug}/${itemId}`,
          images: show.imageUrl
            ? [{ url: show.imageUrl, width: 1200, height: 630, alt: show.title }]
            : [],
          type: "article",
        },
        twitter: {
          card: "summary_large_image",
          title: show.title,
          description: show.description?.replace(/<[^>]*>/g, "").slice(0, 160),
          images: show.imageUrl ? [show.imageUrl] : [],
        },
      }),
    };
  }

  if (pageConfig.format === "team") {
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
