"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSiteData } from "@/contexts/SiteDataContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArticleData } from "@/types/Shows";

interface MediaPageClientProps {
  items: ArticleData[];
}

const MediaPageClient = ({ items }: MediaPageClientProps) => {
  const siteData = useSiteData();
  const mountedRef = useRef(false);
  const types = ["All", "Article", "Videos", "Podcasts"];
  const [activeType, setActiveType] = useState("All");
  const [filteredItems, setFilteredItems] = useState<ArticleData[]>(items);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    
    setLoading(true);
    console.log('Filtering items for type:', activeType);
    const timer = setTimeout(() => {
      const filtered =
        activeType === "All"
          ? items
          : items.filter(
              (item) =>
                item.type?.toLowerCase() === activeType.toLowerCase()
            );
      setFilteredItems(filtered);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [activeType, items]);

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="mx-auto max-w-5xl px-6 text-center space-y-6 mb-16">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          Welcome to Our <span className="text-primary">Media Hub</span>
        </h1>
        <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
          Discover articles, watch videos, and tune into podcasts — all in one
          place. Stay inspired and informed with stories that matter.
        </p>
      </section>
      <section className="mx-auto max-w-6xl px-6 mb-12">
        <div className="flex justify-center flex-wrap gap-3 text-sm font-medium">
          {types.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              style={{
                background:
                  activeType === type
                    ? siteData?.primary
                    : siteData?.surface,
                color:
                  activeType === type
                    ? siteData?.["text-inverse"]
                    : siteData?.["text-primary"],
              }}
              className="px-4 py-2 rounded-md transition-all duration-300 cursor-pointer hover:opacity-90"
            >
              {type}
            </button>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6">
        {loading ? (
          <SkeletonGrid />
        ) : filteredItems?.length > 0 ? (
          <div
            key={activeType}
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 transition-opacity duration-500 animate-fade-in"
          >
            {filteredItems.map((item, idx) => (
              <Link
                key={`media_item_${idx}`}
                href={`/media-hub/${item.slug}`}
                className="block h-full group focus:outline-none"
              >
                <Card className="h-full rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-lg">
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image
                      src={
                        item.image ||
                        `https://picsum.photos/seed/${idx}/600/400`
                      }
                      alt={item.title}
                      width={600}
                      height={400}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full capitalize">
                      {item.type || "Article"}
                    </span>
                  </div>

                  <CardHeader>
                    <CardTitle as="h2" className="line-clamp-2">
                      {item.title}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      {item.date
                        ? new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(item.date))
                        : null}
                    </p>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            No {activeType} found.
          </p>
        )}
      </section>
    </main>
  );
};

export default MediaPageClient;

const SkeletonGrid = () => (
  <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 animate-pulse">
    {Array.from({ length: 6 }).map((_, idx) => (
      <div
        key={`skeleton_${idx}`}
        className="rounded-xl shadow-md overflow-hidden flex flex-col bg-white border border-gray-100"
      >
        <div className="h-48 w-full bg-gray-200" />
        <div className="p-4 space-y-3">
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    ))}
  </div>
);