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
} from "@/components/UI/card";
import { ShowData } from "@/types/Shows";

interface ShowPageClientProps {
  items: ShowData[];
}

const ShowPageClient = ({ items }: ShowPageClientProps) => {
  const siteData = useSiteData();
  const mountedRef = useRef(false);
  const types = ["All", "Article", "Videos", "Podcasts"];
  const [activeType, setActiveType] = useState("All");
  const [filteredItems, setFilteredItems] = useState<ShowData[]>(items);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    
    setLoading(true);
    const timer = setTimeout(() => {
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [activeType, items]);
  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="mx-auto max-w-5xl px-6 text-center space-y-6 mb-16">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          Our Shows
        </h1>
        <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
          Explore our upcoming shows, featuring the best in comedy and entertainment.
        </p>
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
                href={`/shows/${item.id}`}
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

export default ShowPageClient;

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