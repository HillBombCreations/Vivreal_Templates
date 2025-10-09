"use client";

import { useEffect, FC } from "react"
import { ArticleData } from "@/types/Articles";
import { useSiteData } from "@/contexts/SiteDataContext";
import Link from "next/link";
import Head from "next/head";
import Image from "next/image";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import {
  Code,
  BookOpen,
  FileCode,
  ArrowRight,
} from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/UI/carousel";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/UI/card";
import CTASection from "../CTASection";

const Developers: FC<ArticleData[]> = (props) => {
  const siteData = useSiteData();
  useEffect(() => {
      // Dynamically load Postman button script after component renders
      const script = document.createElement("script");
      script.src = "https://run.pstmn.io/button.js";
      script.async = true;
      document.body.appendChild(script);

      return () => {
      // clean up script if needed
      document.body.removeChild(script);
      };
  }, []);

  const slides = (() => {
    const values = Object.values(props);
    if (!values.length) return [];

    const MIN_SLIDES = 5;
    const target = Math.max(MIN_SLIDES, values.length);

    return Array.from({ length: target }, (_, i) => values[i % values.length]);
  })();
    
  return (
    <>
      <Head>
        <title>Developer Tools & Docs | Vivreal</title>
        <meta
          name="description"
          content="Everything developers need to build, integrate, and customize with Vivreal API docs, guides, blog posts, and more."
        />
        <link rel="canonical" href={'https://www.vivreal.io/developers'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="text-center bg-blue-50 px-5 md:px-0 py-10 space-y-6 rounded-xl">
            <h1 className="text-3xl md:text-5xl font-display font-bold">
              Build with <span style={{ color: siteData?.primary }}>Confidence</span>
            </h1>
            <p className="text-gray-800 text-md md:text-lg max-w-3xl mx-auto">
              Explore APIs, SDKs, and technical docs to integrate Vivreal into your stack fast, scalable, and developer-friendly.
            </p>
          </div>
          <section className="space-y-8">
            <div className="space-y-3">
                <h2 className="text-2xl md:text-3xl font-bold font-display">Documentation</h2>
                <p style={{ color: siteData?.["text-primary"] }}>
                  Whether you&apos;re integrating our APIs or exploring our SDKs, all developer documentation is in one place.
                </p>
              </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  title: "Vivreal Docs",
                  description: "Platform setup, integrations, and guides.",
                  link: "https://docs.vivreal.io/",
                  icon: FileCode,
                },
                {
                  title: "Git Book",
                  description: "In-depth technical documentation for advanced use cases.",
                  link: "https://vivreal.gitbook.io/api/",
                  icon: BookOpen,
                },
                {
                  title: "Postman API",
                  description: "Test and explore Vivreal APIs using Postman.",
                  link: "https://www.postman.com/vivreal",
                  icon: Code,
                },
              ].map((doc, idx) => (
                <div key={`${doc.title}-${idx}`}>
                {
                    doc.title === "Postman API" ?
                    <div
                      className="border rounded-lg p-6 hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        <doc.icon style={{ color: siteData?.primary }} className="w-6 h-6 mb-4" />
                        <h3 style={{ color: siteData?.["text-primary"] }} className="font-semibold text-lg">{doc.title}</h3>
                        <p style={{ color: siteData?.["text-primary"] }} className="text-sm mt-1">{doc.description}</p>
                      </div>
                      <div className="mt-6 flex flex-row sm:items-center gap-8">
                        <a
                          href={doc.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          View docs <ArrowRight size={14} />
                        </a>
                        <div
                          className="postman-run-button"
                          data-postman-action="collection/fork"
                          data-postman-visibility="public"
                          data-postman-var-1="47694755-74d93529-f462-4551-ae50-ab17f0f01a08"
                          data-postman-collection-url="entityId=47694755-74d93529-f462-4551-ae50-ab17f0f01a08&entityType=collection&workspaceId=e70746de-bc98-49f3-bdc0-2e7e39f1ba59"
                        ></div>
                      </div>
                    </div>
                :
                    <a
                        href={doc.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border rounded-lg p-6 hover:shadow-md transition block"
                    >
                        <doc.icon style={{ color: siteData?.primary }} className="w-6 h-6 mb-4" />
                        <h3 style={{ color: siteData?.["text-primary"] }}className="font-semibold text-lg">{doc.title}</h3>
                        <p style={{ color: siteData?.["text-primary"] }} className="text-sm mt-1">{doc.description}</p>
                        <div style={{ color: siteData?.["text-primary"] }} className="mt-4 text-sm font-medium flex items-center gap-1">
                            View docs <ArrowRight size={14} />
                        </div>
                    </a>
                }
                </div>
                
              ))}
            </div>
          </section>
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl md:text-3xl font-bold font-display">Latest Developer Posts</h2>
              <Link
                href="/developers/articles"
                style={{ color: siteData?.["text-primary"] }}
                className="text-sm font-medium hover:underline flex items-center gap-1"
              >
                View all <ArrowRight size={16} />
              </Link>
            </div>
            <Carousel opts={{ align: "start", loop: true }}>
              <CarouselContent className="">
                {slides.map((blog, index) => (
                  <CarouselItem
                    key={`${blog.slug}-dup-${index}`}
                    className="md:basis-1/2 lg:basis-1/3"
                  >
                    <Link
                      href={`/developers${blog.slug}`} 
                      className="block h-full group focus:outline-none py-2"
                      aria-label={`Read blog: ${blog.title}`}
                    >
                      <Card className="h-full rounded-2xl shadow-md overflow-hidden flex flex-col transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl">
                        <div className="relative h-48 w-full overflow-hidden">
                          <Image
                            src={blog.image || `https://picsum.photos/seed/${index}/600/400`}
                            alt={blog.title}
                            width={600}
                            height={400}
                            className="transition-transform duration-300 group-hover:scale-105"
                            priority
                          />
                          <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 group-hover:ring-primary/20" />
                        </div>
                        <CardHeader className="space-y-1">
                          <CardTitle className="line-clamp-2">{blog.title}</CardTitle>
                          <p style={{ color: siteData?.["text-secondary"] }} className="text-sm">{blog.date}</p>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <p style={{ color: siteData?.["text-secondary"] }} className="text-sm line-clamp-3">
                            {blog.description}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <div className="hidden md:flex justify-between mt-4">
                <CarouselPrevious className="btn" />
                <CarouselNext className="btn" />
              </div>
            </Carousel>
          </section>
          <section className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold font-display">Community & Channels</h2>
            <p style={{ color: siteData?.["text-primary"] }} className="text-base">
              Extend Vivreal with our SDKs, sample apps, and public tooling.
            </p>

            <div className="grid gap-6 md:grid-cols-3">
                <a
                    href="https://discord.gg/8vr5vK3C"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-5 rounded-lg hover:border-primary transition"
                    >
                    <div className="flex items-center gap-3 mb-2">
                        <Image
                        width={20}
                        height={20}
                        src="/discordLogo.svg"
                        alt="Discord"
                        className="w-5 h-5"
                        />
                        <span className="font-medium">Join Us on Discord</span>
                    </div>
                    <p style={{ color: siteData?.["text-primary"] }} className="text-sm">
                        Ask questions, get support, and connect directly with the Vivreal team and community.
                    </p>
                    </a>

                    <a
                    href="https://www.reddit.com/r/Vivreal"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-5 rounded-lg hover:border-primary transition"
                    >
                    <div className="flex items-center gap-3 mb-2">
                        <Image
                        width={20}
                        height={20}
                        src="/redditLogo.svg"
                        alt="Reddit"
                        className="w-5 h-5"
                        />
                        <span className="font-medium">r/Vivreal on Reddit</span>
                    </div>
                    <p style={{ color: siteData?.["text-primary"] }} className="text-sm">
                        Join our Reddit community for help, inspiration, and discussion around Vivreal.
                    </p>
                    </a>

                    <a
                    href="https://x.com/Vivreal_io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border p-5 rounded-lg hover:border-primary transition"
                    >
                    <div className="flex items-center gap-3 mb-2">
                        <Image
                        width={20}
                        height={20}
                        src="/xLogo.png"
                        alt="X (formerly Twitter)"
                        className="w-5 h-5"
                        />
                        <span className="font-medium">Dev Announcements</span>
                    </div>
                    <p style={{ color: siteData?.["text-primary"] }} className="text-sm">
                        Follow us for updates on new APIs, SDK releases, and more.
                    </p>
                    </a>
            </div>
          </section>
        </section>
      </main>

      <CTASection page="developers" />
      <Footer />
    </>
  );
};

export default Developers;