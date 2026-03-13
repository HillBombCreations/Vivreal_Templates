"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShowData } from "@/types/Shows";
import { Calendar, MapPin, Loader2 } from "lucide-react";

interface ShowPageClientProps {
  upcomingShows: ShowData[];
  pastShows: ShowData[];
  labels: { title: string; subtitle: string; upcoming: string; past: string };
  slug: string;
  collectionId: string;
  totalCount: number;
}

const PAGE_SIZE = 20;

const ShowPageClient = ({
  upcomingShows,
  pastShows: initialPastShows,
  labels,
  slug,
  collectionId,
  totalCount,
}: ShowPageClientProps) => {
  const [pastShows, setPastShows] = useState(initialPastShows);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedAll = useRef(
    upcomingShows.length + initialPastShows.length >= totalCount
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || loadedAll.current) return;
    setLoadingMore(true);

    try {
      const skip = upcomingShows.length + pastShows.length;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip: String(skip),
        ...(collectionId ? { collectionId } : {}),
      });

      const res = await fetch(`/api/shows?${params}`);
      const json = await res.json();

      if (json.success && json.data?.shows?.length) {
        const today = new Date();
        const newPast = (json.data.shows as ShowData[]).filter(
          (s) => s.date && new Date(s.date) < today
        );
        setPastShows((prev) => [...prev, ...newPast]);

        if (
          skip + json.data.shows.length >= json.data.totalCount ||
          json.data.shows.length < PAGE_SIZE
        ) {
          loadedAll.current = true;
        }
      } else {
        loadedAll.current = true;
      }
    } catch (err) {
      console.error("Failed to load more shows:", err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, upcomingShows.length, pastShows.length, collectionId]);

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      <section className="mx-auto max-w-6xl px-6 text-center space-y-6 mb-16">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          {labels.title}
        </h1>
        <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
          {labels.subtitle}
        </p>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-7xl px-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">
          {labels.upcoming}
        </h2>
        {upcomingShows?.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 transition-opacity duration-500 animate-fade-in">
            {upcomingShows.map((item, idx) => (
              <Link
                key={`upcoming_${idx}`}
                href={`/${slug}/${item.id}`}
                className="block h-full group focus:outline-none"
              >
                <Card className="h-full rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-lg">
                  <div className="relative w-full overflow-hidden bg-gray-100">
                    <Image
                      src={item.imageUrl || item.image || "/logo.png"}
                      alt={item.title || "Content image"}
                      width={600}
                      height={500}
                      className="w-full h-72 object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  <CardHeader>
                    <CardTitle as="h2" className="text-xl line-clamp-2">
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
                    <div
                      className="text-sm text-gray-600 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
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
      <section className="mx-auto max-w-7xl px-6 mt-16">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">
          {labels.past}
        </h2>
        {pastShows?.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {pastShows
                .filter((show) => show.imageUrl || show.image)
                .map((show, idx) => (
                  <Link
                    key={`past_${idx}`}
                    href={`/${slug}/${show.id}`}
                    className="relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100 group"
                  >
                    <Image
                      src={show.imageUrl || show.image || "/logo.png"}
                      alt={show.title || `Past content ${idx + 1}`}
                      width={400}
                      height={500}
                      className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                      <h3 className="text-white text-sm font-semibold line-clamp-2">
                        {show.title}
                      </h3>
                      {show.date && (
                        <p className="text-white/80 text-xs mt-1">
                          {new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(show.date))}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
            </div>

            {!loadedAll.current && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-lg font-semibold text-sm transition-colors bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500">No past content yet.</p>
        )}
      </section>
    </main>
  );
};

export default ShowPageClient;
