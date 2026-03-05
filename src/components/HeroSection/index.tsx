"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShowData } from "@/types/Shows"
import { useSiteData } from "@/contexts/SiteDataContext";
import { ShowSkeletonCard, PastShowSkeleton } from "./skeletonLoader";

// Force runtime fetching instead of static build
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HeroSection = ({ shows }: { shows: ShowData[] }) => {
  const siteData = useSiteData();
  const [isMobile, setIsMobile] = useState(false);
  const [upcomingShows, setUpcomingShows] = useState<ShowData[]>([]);
  const [pastShows, setPastShows] = useState<ShowData[]>([]);
  const [loading, setLoading] = useState(true);

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
    
    const upcoming = shows.filter(show => {
      if (!show.date) return false;
      const showDate = new Date(show.date);
      const today = new Date();
      return showDate >= today;
    }).sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    const past = shows.filter(show => {
      if (!show.date) return false;
      const showDate = new Date(show.date);
      const today = new Date();
      return showDate < today;
    });
    
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
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid items-center gap-12 sm:grid-cols-2">
          <div className="relative">
            <Image
              src="/heroImage.png"
              alt="Hero illustration"
              width={600}
              height={400}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
          <div className="space-y-6 text-center sm:text-left">
            <h1
              id="hero-heading"
              className="text-4xl lg:text-5xl font-display font-bold tracking-tight"
            >
              <small className="text-primary">Welcome to</small>
              <br />
              <span style={{ color: siteData?.primary }}>The Comedy Collective</span>
            </h1>
            <p className="text-gray-700 text-lg md:text-xl max-w-xl mx-auto sm:mx-0">
              The Comedy Collective is Chicago&apos;s newest and hungriest comedy company. Monthly shows at the Den Theatre and more to come!
            </p>
            <hr />
            <span style={{ color: siteData?.primary }}>Featuring top comics from these iconic stages and more!</span>
            <div className="flex flex-wrap justify-center gap-6 mt-8">
              {[
                { src: "/venues/zanies.jpg", alt: "Zanies" },
                { src: "/venues/laughfactory.png", alt: "Laugh Factory" },
                { src: "/venues/secondcity.png", alt: "Second City" },
                { src: "/venues/detroithouseofcomedy.png", alt: "Detroit House of Comedy" },
                { src: "/venues/roastbattle.png", alt: "Roast Battle" },
              ].map((venue, idx) => (
                <div key={idx} className="relative flex justify-center items-center p-4">
                  <Image
                    src={venue.src}
                    alt={venue.alt}
                    width={0}
                    height={0}
                    sizes="(max-width: 768px) 60vw, (max-width: 1024px) 33vw, 5vw"
                    className="max-h-24 w-auto object-contain"
                    priority
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: "#001a4a",
                      mixBlendMode: "screen",
                      opacity: 1,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">Upcoming Shows</h2>
        {loading ? (
          <div className="flex flex-col gap-4 mt-6" aria-busy="true">
            {[...Array(5)].map((_, i) => (
              <ShowSkeletonCard key={i} isMobile={isMobile} />
            ))}
          </div>
        ) : upcomingShows.length === 0 ? (
          <p className="mt-6 text-gray-500">No upcoming shows at the moment.</p>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {upcomingShows.map((show, idx) => (
            <Link
              href={`/shows/${show.id}`}
              key={idx}
              className={`
                flex ${isMobile ? 'flex-col' : 'flex-row'}
                rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition hover:shadow-lg
              `}
            >
              <div
                className={`
                  ${isMobile ? 'w-full h-48 rounded-t-lg' : 'flex-shrink-0 w-40 h-auto rounded-l-lg'}
                  overflow-hidden
                `}
              >
                <Image
                  src={show.imageUrl || show.image || '/comedycollectivelogo.png'}
                  alt={show.title || 'Show poster'}
                  width={0}
                  height={0}
                  sizes={isMobile ? "100vw" : "350px"}
                  className="w-full h-full object-contain"
                  priority
                  onError={(e) => { e.currentTarget.src = '/comedycollectivelogo.png'; }}
                />
              </div>
              <div className={`${isMobile ? 'p-4 rounded-b-lg flex flex-col items-center text-center' : 'flex-1 p-4 flex flex-col justify-between'}`}>
                <div>
                  <h3 className="text-2xl font-semibold">{show.title}</h3>
                  <article className="prose prose-p:min-h-[.4em]">
                    <div className="text-gray-600 text-sm mt-1 line-clamp-4" dangerouslySetInnerHTML={{ __html: show.description }} />
                  </article>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (show.ticketsUrl) {
                      window.open(show.ticketsUrl, "_blank", "noopener,noreferrer");
                    }
                  }}
                  className={`
                    mt-4 px-4 py-2 cursor-pointer bg-[#001a4a] text-white text-sm font-semibold rounded hover:bg-[#003366] transition
                    ${isMobile ? 'w-full max-w-xs' : 'w-max self-start'}
                  `}
                  aria-label="Open tickets in a new tab"
                >
                  TICKETS
                </button>
              </div>
            </Link>
          ))}
        </div>
        )}
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">Past Shows</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-14" aria-busy="true">
            {[...Array(10)].map((_, i) => (
              <PastShowSkeleton key={i} />
            ))}
          </div>
        ) : pastShows.length === 0 ? (
          <p className="mt-6 text-gray-500">No past shows yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-14">
            {pastShows.filter(show => show.imageUrl || show.image).map((show, idx) => (
              <div key={idx} className="relative overflow-hidden rounded-lg shadow-sm hover:shadow-md transition">
                <Image
                  src={show.imageUrl || show.image || '/comedycollectivelogo.png'}
                  alt={show.title || `Poster ${idx + 1}`}
                  width={0}
                  height={0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="w-full h-64 object-contain"
                  priority
                  onError={(e) => { e.currentTarget.src = '/comedycollectivelogo.png'; }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroSection;