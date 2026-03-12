"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShowData } from "@/types/Shows";
import { useSiteData } from "@/contexts/SiteDataContext";
import { ShowSkeletonCard, PastShowSkeleton } from "./skeletonLoader";
import { Calendar, MapPin, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HeroSection = ({ shows }: { shows: ShowData[] }) => {
  const siteData = useSiteData();
  const [isMobile, setIsMobile] = useState(false);
  const [upcomingShows, setUpcomingShows] = useState<ShowData[]>([]);
  const [pastShows, setPastShows] = useState<ShowData[]>([]);
  const [loading, setLoading] = useState(true);

  const primary = siteData?.primary || '#000000';
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    setLoading(true);

    if (shows.length === 0) {
      setUpcomingShows([]);
      setPastShows([]);
      setLoading(false);
      return;
    }

    const today = new Date();
    const upcoming = shows
      .filter((show) => show.date && new Date(show.date) >= today)
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

    const past = shows.filter((show) => show.date && new Date(show.date) < today);

    setUpcomingShows(upcoming);
    setPastShows(past);
    setLoading(false);
  }, [shows]);

  return (
    <section
      style={{ background: siteData?.surface }}
      className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Hero banner */}
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid items-center gap-12 sm:grid-cols-2">
          <div className="relative">
            <Image
              src="/heroImage.png"
              alt="Hero illustration"
              width={600}
              height={400}
              className="w-full h-auto object-contain rounded-2xl"
              priority
            />
          </div>
          <div className="space-y-6 text-center sm:text-left">
            <h1
              id="hero-heading"
              className="text-4xl lg:text-5xl font-display font-bold tracking-tight"
            >
              <small style={{ color: primary }}>Welcome to</small>
              <br />
              <span style={{ color: primary }}>{siteName}</span>
            </h1>
            <p className="text-gray-700 text-lg md:text-xl max-w-xl mx-auto sm:mx-0">
              Discover our latest content, upcoming events, and more.
            </p>
          </div>
        </div>

        {/* Upcoming content */}
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">
          Upcoming
        </h2>

        {loading ? (
          <div className="flex flex-col gap-4 mt-6" aria-busy="true">
            {[...Array(3)].map((_, i) => (
              <ShowSkeletonCard key={i} isMobile={isMobile} />
            ))}
          </div>
        ) : upcomingShows.length === 0 ? (
          <p className="mt-6 text-gray-500">Nothing upcoming at the moment. Check back soon!</p>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {upcomingShows.map((show, idx) => (
              <Link
                href={`/shows/${show.id}`}
                key={idx}
                className={`
                  flex ${isMobile ? 'flex-col' : 'flex-row'}
                  rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden
                  transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
                `}
              >
                <div
                  className={`
                    ${isMobile ? 'w-full h-48 rounded-t-xl' : 'flex-shrink-0 w-44 h-auto rounded-l-xl'}
                    overflow-hidden bg-gray-100
                  `}
                >
                  <Image
                    src={show.imageUrl || show.image || '/logo.png'}
                    alt={show.title || 'Content image'}
                    width={0}
                    height={0}
                    sizes={isMobile ? "100vw" : "350px"}
                    className="w-full h-full object-contain"
                    priority
                  />
                </div>
                <div className={`${isMobile ? 'p-5 rounded-b-xl flex flex-col items-center text-center' : 'flex-1 p-5 flex flex-col justify-between'}`}>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{show.title}</h3>
                    <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
                      {show.date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={14} />
                          {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(show.date))}
                          {show.time ? ` at ${show.time}` : ''}
                        </span>
                      )}
                      {show.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={14} />
                          {show.location}
                        </span>
                      )}
                    </div>
                    <article className="prose prose-p:min-h-[.4em]">
                      <div className="text-gray-600 text-sm mt-2 line-clamp-3" dangerouslySetInnerHTML={{ __html: show.description }} />
                    </article>
                  </div>
                  {show.ticketsUrl ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(show.ticketsUrl, "_blank", "noopener,noreferrer");
                      }}
                      className={`
                        mt-4 inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer text-white text-sm font-semibold rounded-lg transition-colors
                        ${isMobile ? 'w-full max-w-xs justify-center' : 'w-max self-start'}
                      `}
                      style={{ backgroundColor: primary }}
                      aria-label="Open tickets in a new tab"
                    >
                      Get Tickets <ArrowRight size={14} />
                    </button>
                  ) : (
                    <span
                      className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${isMobile ? '' : 'self-start'}`}
                      style={{ color: primary }}
                    >
                      View Details <ArrowRight size={14} />
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Past content */}
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">
          Past
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6" aria-busy="true">
            {[...Array(10)].map((_, i) => (
              <PastShowSkeleton key={i} />
            ))}
          </div>
        ) : pastShows.length === 0 ? (
          <p className="mt-6 text-gray-500">No past content yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-6">
            {pastShows.filter(show => show.imageUrl || show.image).map((show, idx) => (
              <Link
                key={idx}
                href={`/shows/${show.id}`}
                className="relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100"
              >
                <Image
                  src={show.imageUrl || show.image || '/logo.png'}
                  alt={show.title || `Past content ${idx + 1}`}
                  width={0}
                  height={0}
                  sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                  className="w-full h-64 object-contain"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroSection;
