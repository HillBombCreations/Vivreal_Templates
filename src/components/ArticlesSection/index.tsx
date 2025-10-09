"use client";

import { useMemo, FC } from "react"
import Link from "next/link";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/UI/carousel"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/UI/card"
import { ArticlesSectionProps } from "@/types/Articles"
import { ArrowRight } from "lucide-react"

const ArticlesSection: FC<ArticlesSectionProps> = (props) => {
  const { articleSectionData, siteData } = props;

  const slides = useMemo(() => {
    const carouselData = articleSectionData?.carouselData ?? [];
    if (!carouselData.length) return [];
    const MIN_SLIDES = 5;
    const target = Math.max(MIN_SLIDES, carouselData.length);
    return Array.from({ length: target }, (_, i) => carouselData[i % carouselData.length]);
  }, [articleSectionData]);

  if (!articleSectionData || articleSectionData?.carouselData?.length === 0) {
    return <p className="text-center text-gray-500">{articleSectionData?.noDataMessage}</p>
  }

  return (
    <section style={{ background: siteData?.["surface-alt"] }} className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
      <div className="relative w-full md:max-w-6xl px-5 md:px-0 mx-auto py-12">
        <div className="flex flex-row items-center justify-between mb-12 space-y-0">
          <h2 className="text-3xl md:text-4xl font-display font-bold max-w-sm md:max-w-xl tracking-tight">
            {articleSectionData?.title}
          </h2>
          <a
            href={articleSectionData?.linkSlug}
            style={{ color: siteData?.primary }}
            className="font-semibold flex items-center gap-1 hover:underline"
          >
            {articleSectionData?.linkText} <ArrowRight className="w-5 h-5" />
          </a>
        </div>
        <div style={{ color: siteData?.["text-secondary"] }} className="md:hidden flex items-center justify-end mb-4 text-sm animate-bounce">
          {articleSectionData?.mobileLabel}
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
                  <Card className="h-full rounded-2xl shadow-md overflow-hidden flex bg-white flex-col transition-transform duration-200 group-hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-xl">
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={blog.image || `https://picsum.photos/seed/${index}/600/400`}
                        alt={blog.title}
                        width={600}
                        height={400}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        priority
                      />
                      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/5 group-hover:ring-primary/20" />
                    </div>

                    <CardHeader className="space-y-1">
                      <CardTitle className="line-clamp-2">{blog.title}</CardTitle>
                      <p style={{ color: siteData?.["text-secondary"] }} className="text-sm">{
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
            <CarouselPrevious className="btn bg-white" />
            <CarouselNext className="btn bg-white" />
          </div>
        </Carousel>
      </div>
    </section>
  )
}

export default ArticlesSection;