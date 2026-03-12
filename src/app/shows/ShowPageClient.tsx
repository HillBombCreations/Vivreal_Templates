"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShowData } from "@/types/Shows";
import { Calendar, MapPin } from "lucide-react";

interface ShowPageClientProps {
  upcomingShows: ShowData[];
  pastShows: ShowData[];
}

const ShowPageClient = ({ upcomingShows, pastShows }: ShowPageClientProps) => {
  const mountedRef = useRef(false);
  const [activeType, setActiveType] = useState("All");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, [activeType, upcomingShows]);

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="mx-auto max-w-5xl px-6 text-center space-y-6 mb-16">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          All Content
        </h1>
        <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
          Browse our upcoming and past content — events, highlights, and more.
        </p>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">Upcoming</h2>
        {loading ? (
          <SkeletonGrid />
        ) : upcomingShows?.length > 0 ? (
          <div
            key={activeType}
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 transition-opacity duration-500 animate-fade-in"
          >
            {upcomingShows.map((item, idx) => (
              <Link
                key={`upcoming_${idx}`}
                href={`/shows/${item.id}`}
                className="block h-full group focus:outline-none"
              >
                <Card className="h-full rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-lg">
                  <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                    <Image
                      src={item.imageUrl || item.image || '/logo.png'}
                      alt={item.title || 'Content image'}
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
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                      {item.date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} />
                          {new Intl.DateTimeFormat("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }).format(new Date(item.date))}
                          {item.time ? ` at ${item.time}` : ""}
                        </span>
                      )}
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <div className="text-sm text-gray-600 line-clamp-3" dangerouslySetInnerHTML={{ __html: item.description }} />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Nothing upcoming at the moment. Check back soon!
          </p>
        )}
      </section>

      {/* Past */}
      <section className="mx-auto max-w-6xl px-6 mt-16">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">Past</h2>
        {pastShows?.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {pastShows.filter(show => show.imageUrl || show.image).map((show, idx) => (
              <Link
                key={`past_${idx}`}
                href={`/shows/${show.id}`}
                className="relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100"
              >
                <Image
                  src={show.imageUrl || show.image || '/logo.png'}
                  alt={show.title || `Past content ${idx + 1}`}
                  width={300}
                  height={400}
                  className="w-full h-64 object-contain"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            No past content yet.
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
          <div className="h-5 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    ))}
  </div>
);
