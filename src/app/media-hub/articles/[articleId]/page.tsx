import Link from "next/link";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { getArticleBySlug } from "@/lib/api/media-hub";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ArticlePost = async (props: { params: { articleId: string } }) => {
  const { articleId } = props.params;
  const article = await getArticleBySlug(articleId || "");
  const cleanBody = (article?.body ?? "")
    .replace(/<p>\s*<\/p>/g, "")
    // .replace(/(<\/p>)/g, "$1<br/>")
    .replace(/(<h[1-6][^>]*>)/g, "<br/>$1")
    .replace(/(<\/h[1-6]>)/g, "$1<br/>")
    .replace(/<ul>/g, '<ul class="list-disc ml-6 mb-4">')
    .replace(/<ol>/g, '<ol class="list-decimal ml-6 mb-4">')
    .replace(/<li>/g, '<li class="mb-2">');

  if (!article) {
      return (
      <>
          <Navbar />
          <main className="pt-24 md:pt-32 pb-20 md:pb-32 text-center">
          <h1 className="text-3xl font-bold">Article not found</h1>
          <p className="mt-4 text-gray-800">Sorry, we couldn&apos;t find the article you&apos;re looking for.</p>
          <Link href="/media-hub" className="inline-flex items-center gap-1 mt-6 text-primary hover:underline">
              <ArrowLeft size={16} /> Back to Article List
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
          <ArrowLeft size={16} /> Back to Article List
        </Link>
        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
          {article.title}
        </h1>
        <p className="text-gray-800 text-sm mb-4">
          {article.date
            ? new Intl.DateTimeFormat("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              }).format(new Date(article.date))
            : null}
        </p>

        {article.image && (
          <div className="w-full mb-8">
            <Image
              src={article.image}
              alt={article.title}
              width={800}
              height={400}
              priority
              className="w-full h-auto rounded-2xl object-cover shadow-sm"
            />
          </div>
        )}

        <p className="text-lg mb-10">{article.description}</p>
        <article className="prose prose-lg md:prose-xl prose-primary prose-headings:font-display prose-headings:font-bold prose-headings:text-primary prose-p:mb-6">
          <div dangerouslySetInnerHTML={{ __html: cleanBody ?? "" }} />
        </article>
      </main>

      <CTASection />
      <Footer />
    </>
  );
};

export default ArticlePost;

export const generateMetadata = async (props: { params: { articleId: string } }) => {
  const { articleId } = props.params;
  const article = await getArticleBySlug(articleId || "");
  if (!article) {
    return {
      title: "Article not found | Vivreal",
      description: "Sorry, we couldn’t find that article.",
    };
  }

  return {
    title: `${article.title} | Vivreal Article`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      url: `https://vivreal.io/developers/media-hub/${articleId}`,
      images: article.imageUrl
        ? [
            {
              url: article.imageUrl,
              width: 1200,
              height: 630,
              alt: article.title,
            },
          ]
        : [],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.description,
      images: article.imageUrl ? [article.imageUrl] : [],
    },
  };
};
