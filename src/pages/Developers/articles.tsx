import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Blog } from "@/types/Blogs"
const ArticlesPage = () => {
  const [blogs, setBlogs] = useState<Blog[]>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/data/blogsData.json")
      .then((res) => res.json())
      .then((data) => {
        setBlogs(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load blogs:", err);
        setLoading(false);
      });
  }, []);
  return (
    <>
      <Helmet>
        <title>Vivreal Blog | Articles, Updates & Insights</title>
        <meta name="description" content="Explore in-depth articles and product updates from Vivreal. Learn about structured content, CMS strategies, and more." />
        <link rel="canonical" href={'https://www.vivreal.io/developers/articles'} />
      </Helmet>

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

          {loading ? (
            <div className="col-span-full flex justify-center items-center py-16">
              <svg
                className="animate-spin h-8 w-8 text-primary"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
            </div>
          ) : blogs?.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {blogs.map((blog, idx) => (
                <Link
                  key={`blogsPage_blog_${idx}`}
                  to={`/developers${blog.slug}`} 
                  className="block h-full group focus:outline-none"
                  aria-label={`Read blog: ${blog.title}`}
                >
                <Card className="h-full rounded-2xl shadow-md overflow-hidden flex flex-col transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl hover:shadow-[0_4px_12px_rgba(168,85,247,0.3)]">
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={blog.image || `https://picsum.photos/seed/${idx}/600/400`}
                      alt={blog.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 group-hover:ring-primary/20" />
                  </div>
                  <CardHeader className="space-y-1">
                    <CardTitle as="h2" className="line-clamp-2">{blog.title}</CardTitle>
                    <p className="text-sm text-gray-500">{blog.date}</p>
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
