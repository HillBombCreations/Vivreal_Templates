import Link from "next/link";
import Head from "next/head";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import Image from "next/image";
import { getArticles } from "@/lib/api/developers";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/UI/card"
import { ArticleData } from "@/types/Articles"
const  ArticlesPage = async () => {
  const articlePageData = await getArticles();
  const articles: ArticleData[] = articlePageData?.carouselData || [];

  return (
    <>
      <Head>
        <title>Vivreal Blog | Articles, Updates & Insights</title>
        <meta name="description" content="Explore in-depth articles and product updates from Vivreal. Learn about structured content, CMS strategies, and more." />
        <link rel="canonical" href={'https://www.vivreal.io/developers/articles'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-purple-50 px-5 md:px-0 py-10 rounded-xl text-center space-y-6">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight" style={{ animationDelay: "100ms" }}>
              Latest <span className="text-purple-700">Articles & Updates</span>
            </h1>
            <p className="text-gray-800 text-lg animate-fade-in" style={{ animationDelay: "200ms" }}>
              Insights on headless content, platform innovation, and best practices for developers and teams.
            </p>
          </div>

           {articles?.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((blog, idx) => (
                <Link
                  key={`blogsPage_blog_${idx}`}
                  href={`/developers/${blog.slug}`}
                  className="block h-full group focus:outline-none"
                  aria-label={`Read blog: ${blog.title}`}
                >
                  <Card className="h-full rounded-2xl shadow-md overflow-hidden flex flex-col transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl hover:shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={blog.image || `https://picsum.photos/seed/${idx}/600/400`}
                        alt={blog.title}
                        width={600}
                        height={400}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 group-hover:ring-primary/20" />
                    </div>
                    <CardHeader className="space-y-1">
                      <CardTitle as="h2" className="line-clamp-2">{blog.title}</CardTitle> 
                      <p className="text-sm text-gray-500">{
                        blog.date
                        ? new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(blog.date))
                        : null
                      }</p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <p className="text-sm text-gray-600 line-clamp-3">
                        {blog.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : null}
        </section>
      </main>

      <CTASection page=""/>
      <Footer />
    </>
  );
};

export default ArticlesPage;

export const generateMetadata = async () => {
  return {
    title: "Vivreal - Articles",
    description: "Explore our collection of articles featuring insights on technology, upcoming system updates, and other topics we’re passionate about. We love sharing ideas and we hope you enjoy diving into them.",
    openGraph: {
      title: "Vivreal - Articles",
      description: "Explore our collection of articles featuring insights on technology, upcoming system updates, and other topics we’re passionate about. We love sharing ideas and we hope you enjoy diving into them.",
      url: "https://vivreal.io/developers",
      images: [
        {
          url: new URL("/articlesThumbnail.png", "https://vivreal.io"),
          width: 1200,
          height: 630,
          alt: "Vivreal - Articles",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Vivreal - Articles",
      description: "Explore our collection of articles featuring insights on technology, upcoming system updates, and other topics we’re passionate about. We love sharing ideas and we hope you enjoy diving into them.",
      images: [
        new URL("/articlesThumbnail.png", "https://vivreal.io"),
      ],
    },
  }
}