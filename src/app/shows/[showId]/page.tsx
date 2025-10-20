import Link from "next/link";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getShowById } from "@/lib/api/shows";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ShowPost = async (props: { params: { showId: string } }) => {
  const { showId } = props.params;
  const show = await getShowById(showId || "");

  const cleanBody = ("")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/(<h[1-6][^>]*>)/g, "<br/>$1")
    .replace(/(<\/h[1-6]>)/g, "$1<br/>")
    .replace(/<ul>/g, '<ul class="list-disc ml-6 mb-4">')
    .replace(/<ol>/g, '<ol class="list-decimal ml-6 mb-4">')
    .replace(/<li>/g, '<li class="mb-2">');

  if (!show) {
      return (
      <>
          <Navbar />
          <main className="pt-24 md:pt-32 pb-20 md:pb-32 text-center">
          <h1 className="text-3xl font-bold">Show not found</h1>
          <p className="mt-4 text-gray-800">Sorry, we couldn&apos;t find the show you&apos;re looking for.</p>
          <Link href="/media-hub" className="inline-flex items-center gap-1 mt-6 text-primary hover:underline">
              <ArrowLeft size={16} /> Back to Shows
          </Link>
          </main>
          <Footer />
      </>
      );
  }

  return (
    <>
      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32 max-w-4xl mx-auto px-4 prose prose-primary prose-headings:font-display prose-headings:font-bold prose-headings:text-primary animate-fade-in">
        <Link href="/media-hub" className="inline-flex items-center gap-1 mb-8 text-purple-700 hover:underline">
          <ArrowLeft size={16} /> Back to Shows
        </Link>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
          {show.title}
        </h1>
        <p className="text-gray-800 text-sm mb-4">
          {show.date
            ? new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date(show.date))
            : null}
        </p>

        {show.image && (
          <div className="w-full mb-8">
            <Image
              src={show.image}
              alt={show.title}
              width={800}
              height={400}
              priority
              className="w-full h-auto rounded-2xl object-cover shadow-sm"
            />
          </div>
        )}

        <p className="text-lg mb-10">{show.description}</p>
        <article className="prose prose-lg md:prose-xl prose-primary prose-headings:font-display prose-headings:font-bold prose-headings:text-primary prose-p:mb-6">
          <div dangerouslySetInnerHTML={{ __html: cleanBody ?? "" }} />
        </article>
      </main>

      <CTASection />
      <Footer />
    </>
  );
};

export default ShowPost;

export const generateMetadata = async (props: { params: { showId: string } }) => {
  const { showId } = props.params;
  const show = await getShowById(showId || "");
  if (!show) {
    return {
      title: "show not found | Vivreal",
      description: "Sorry, we couldn't find that show.",
    };
  }

  return {
    title: `${show.title} | Vivreal show`,
    description: show.description,
    openGraph: {
      title: show.title,
      description: show.description,
      url: `https://vivreal.io/developers/media-hub/${showId}`,
      images: show.imageUrl
        ? [
            {
              url: show.imageUrl,
              width: 1200,
              height: 630,
              alt: show.title,
            },
          ]
        : [],
      type: "show",
    },
    twitter: {
      card: "summary_large_image",
      title: show.title,
      description: show.description,
      images: show.imageUrl ? [show.imageUrl] : [],
    },
  };
};
