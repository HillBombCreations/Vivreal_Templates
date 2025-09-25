import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { ArrowLeft } from "lucide-react";
import { Blog } from "@/types/Blogs"

const ArticlePost = () => {
    const { slug } = useParams<{ slug: string }>();
    const [blog, setBlog] = useState<Blog>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const cleanBody = blog?.body
      .replace(/<p>\s*<\/p>/g, "")
      // .replace(/(<\/p>)/g, "$1<br/>")
      .replace(/(<h[1-6][^>]*>)/g, "<br/>$1")
      .replace(/(<\/h[1-6]>)/g, "$1<br/>")
      .replace(/<ul>/g, '<ul class="list-disc ml-6 mb-4">')
      .replace(/<ol>/g, '<ol class="list-decimal ml-6 mb-4">')
      .replace(/<li>/g, '<li class="mb-2">');
      
    useEffect(() => {
        fetch("/data/blogsData.json")
        .then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.json();
        })
        .then((data: Blog[]) => {
            const localBlog = data?.find(b => b.slug === `/articles/${slug}`);
            setBlog(localBlog);
            setLoading(false);
        })
        .catch((err) => {
            setLoading(false);
            console.error(err);
        });
    }, []);
    
    if (!blog) {
        return (
        <>
            <Navbar />
            <main className="pt-24 md:pt-32 pb-20 md:pb-32 text-center">
            <h1 className="text-3xl font-bold">Blog not found</h1>
            <p className="mt-4 text-gray-800">Sorry, we couldn't find the blog you're looking for.</p>
            <Link to="/developers/articles" className="inline-flex items-center gap-1 mt-6 text-primary hover:underline">
                <ArrowLeft size={16} /> Back to Blog List
            </Link>
            </main>
            <Footer />
        </>
        );
    }

  return (
    <>
      <Helmet>
        <title>{blog.title} | Vivreal Article</title>
        <meta name="description" content={blog.description} />
        <link rel="canonical" href={`https://www.vivreal.io/developers/articles/${slug}`} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32 max-w-4xl mx-auto px-4 prose prose-primary prose-headings:font-display prose-headings:font-bold prose-headings:text-primary animate-fade-in">
        <Link to="/developers/articles" className="inline-flex items-center gap-1 mb-8 text-purple-700 hover:underline">
          <ArrowLeft size={16} /> Back to Article List
        </Link>
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
          ) : (
            <>
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
                {blog.title}
              </h1>
              <p className="text-gray-800 text-sm mb-4">{blog.date}</p>

              {blog.image && (
                <div className="w-full mb-8">
                  <img
                    src={blog.image}
                    alt={blog.title}
                    className="w-full h-auto rounded-2xl object-cover shadow-sm"
                  />
                </div>
              )}

              <p className="text-lg mb-10">{blog.description}</p>
              <article className="prose prose-lg md:prose-xl prose-primary prose-headings:font-display prose-headings:font-bold prose-headings:text-primary prose-p:mb-6">
                <div dangerouslySetInnerHTML={{ __html: cleanBody }} />
              </article>
            </>
          )}
      </main>

      <CTASection page=""/>
      <Footer />
    </>
  );
};

export default ArticlePost;