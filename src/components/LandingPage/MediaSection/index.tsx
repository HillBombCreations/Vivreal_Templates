"use client";

import { useMemo, FC } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { ArrowRight } from "lucide-react";
import { useSiteData } from "@/contexts/SiteDataContext";
interface MediaSectionProps {
  title?: string;
  linkText?: string;
  linkSlug?: string;
  mobileLabel?: string;
  noDataMessage?: string;
  carouselData?: {
    slug: string;
    title: string;
    description: string;
    image?: string;
    date?: string;
    type?: string;
  }[];
}

const MediaSection: FC<MediaSectionProps> = (mediaData) => {
  const siteData = useSiteData();
  const slides = useMemo(() => {
    const carouselData = mediaData?.carouselData ?? [];
    if (!carouselData.length) return [];
    const MIN_SLIDES = 5;
    const target = Math.max(MIN_SLIDES, carouselData.length);
    return Array.from({ length: target }, (_, i) => carouselData[i % carouselData.length]);
  }, [mediaData]);

  if (!mediaData || mediaData?.carouselData?.length === 0) {
    return (
      <p className="text-center text-gray-500">
        {mediaData?.noDataMessage ?? "No media items available yet."}
      </p>
    );
  }

  return (
    <section
      style={{ background: siteData?.["surface-alt"] }}
      className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden"
    >
      <div className="relative w-full md:max-w-6xl px-5 md:px-0 mx-auto py-12">
        {/* Section header */}
        <div className="flex flex-row items-center justify-between mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            {mediaData?.title ?? "Latest from Our Media Hub"}
          </h2>
          <Link
            href={mediaData?.linkSlug ?? "/media"}
            style={{ color: siteData?.primary }}
            className="font-semibold flex items-center gap-1 hover:underline group"
          >
            {mediaData?.linkText ?? "View all media"}
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {/* Mobile label */}
        <div
          style={{ color: siteData?.["text-secondary"] }}
          className="md:hidden flex items-center justify-end mb-4 text-sm animate-bounce"
        >
          {mediaData?.mobileLabel ?? "Swipe to explore"}
        </div>

        {/* Carousel */}
        <Carousel opts={{ align: "start", loop: true }}>
          <CarouselContent>
            {slides.map((item, index) => (
              <CarouselItem
                key={`${item.slug}-dup-${index}`}
                className="md:basis-1/2 lg:basis-1/3"
              >
                <Link
                  href={`/media-hub/${item.slug}`}
                  className="block h-full group focus:outline-none py-2"
                  aria-label={`View media: ${item.title}`}
                >
                  <Card className="h-full rounded-2xl shadow-md overflow-hidden flex bg-white flex-col transition-transform duration-200 group-hover:-translate-y-1 hover:shadow-xl">
                    {/* Image */}
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={item.image || `https://picsum.photos/seed/${index}/600/400`}
                        alt={item.title}
                        width={600}
                        height={400}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        priority={index < 3}
                      />
                      <span className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full capitalize">
                        {item.type ?? "Article"}
                      </span>
                    </div>

                    {/* Content */}
                    <CardHeader className="space-y-1">
                      <CardTitle className="line-clamp-2">{item.title}</CardTitle>
                      {item.date && (
                        <p
                          style={{ color: siteData?.["text-secondary"] }}
                          className="text-sm"
                        >
                          {new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(item.date))}
                        </p>
                      )}
                    </CardHeader>

                    <CardContent className="flex-1">
                      <p
                        style={{ color: siteData?.["text-secondary"] }}
                        className="text-sm line-clamp-3"
                      >
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>

          {/* Carousel controls */}
          <div className="hidden md:flex justify-between mt-4">
            <CarouselPrevious className="btn bg-white" />
            <CarouselNext className="btn bg-white" />
          </div>
        </Carousel>
      </div>
    </section>
  );
};

export default MediaSection;