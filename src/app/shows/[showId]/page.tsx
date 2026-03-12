import Link from "next/link";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import Image from "next/image";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { getShowById } from "@/lib/api/shows";
import { getSiteData } from "@/lib/api/siteData";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ShowPost = async ({ params }: { params: Promise<{ showId: string }> }) => {
  const { showId } = await params;
  const show = await getShowById(showId || "");
  const siteData = await getSiteData();
  const primary = siteData?.primary || '#000000';

  if (!show) {
    return (
      <>
        <Navbar />
        <main className="pt-24 md:pt-32 pb-20 md:pb-32 text-center">
          <h1 className="text-3xl font-bold">Not found</h1>
          <p className="mt-4 text-gray-800">Sorry, we couldn&apos;t find the content you&apos;re looking for.</p>
          <Link href="/shows" className="inline-flex items-center gap-1 mt-6 text-primary hover:underline">
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
        <Link href="/shows" className="inline-flex items-center gap-1 mb-8 hover:underline" style={{ color: primary }}>
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
          {show.ticketsUrl && (
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

        <div className="flex flex-col md:flex-row gap-6">
          {(show.imageUrl || show.image) && (
            <div className="w-full mb-4 md:mb-0 md:order-2">
              <Image
                src={show.imageUrl || show.image || '/logo.png'}
                alt={show.title || 'Content image'}
                width={800}
                height={400}
                priority
                className="w-full h-auto rounded-2xl object-cover shadow-sm"
              />
            </div>
          )}
          <div className="text-lg">
            <div dangerouslySetInnerHTML={{ __html: show.description }} />
          </div>
        </div>
      </main>

      <CTASection />
      <Footer />
    </>
  );
};

export default ShowPost;

export const generateMetadata = async ({ params }: { params: Promise<{ showId: string }> }) => {
  const { showId } = await params;
  const [show, siteData] = await Promise.all([getShowById(showId), getSiteData()]);
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';
  const domain = siteData?.domainName || '';

  if (!show) {
    return {
      title: `Not found | ${siteName}`,
      description: "Sorry, we couldn't find that content.",
    };
  }

  return {
    title: `${show.title} | ${siteName}`,
    description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
    ...(domain && {
      openGraph: {
        title: show.title,
        description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
        url: `https://${domain}/shows/${showId}`,
        images: show.imageUrl
          ? [{ url: show.imageUrl, width: 1200, height: 630, alt: show.title }]
          : [],
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: show.title,
        description: show.description?.replace(/<[^>]*>/g, '').slice(0, 160),
        images: show.imageUrl ? [show.imageUrl] : [],
      },
    }),
  };
};
