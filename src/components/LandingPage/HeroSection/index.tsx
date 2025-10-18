"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSiteData } from "@/contexts/SiteDataContext";

const HeroSection = () => {
  const siteData = useSiteData();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const highlights = [
    {
      title: "Hotshots",
      description: "Hotshots! A comedy showcase featuring a blend of Chicago's finest alongside the next generation of household names. This is a must see show.\n\nThe Den Theatre and comedy club is pleased to host Hotshots on November 15, 2025 at 1331 N. Milwaukee Ave. in Chicago's Wicker Park neighborhood.\nTickets are currently available at thedentheatre.com or by calling (773) 697-3830.",
      image: '/posters/hotshots.jpeg',
      ticketsUrl: 'https://thedentheatre.com/performances/2025/11/15/hotshots-the-den-theatre-comedy-club-chicago',
    },
    {
      title: "Uncorked & Unfiltered",
      description: "A Wine and Comedy Experience. Join us for a night of fine wines, laughs, and sophisticated company. Purchase of a ticket includes a wine flight of five wines curated to match each of our hilarious comedians!\n\n 18 October, 2025 | 8:00 PM\n3164 N. Broadway, Chicago, IL 60657",
      image: '/posters/wine.png',
      ticketsUrl: 'https://www.eventbrite.com/e/uncorked-unfiltered-a-wine-comedy-experience-tickets-1730710474619',
    },
  ];

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
        <div className="flex flex-col gap-4 mt-6">
          {highlights.map((h, idx) => (
            <div
              key={idx}
              className={`
                flex ${isMobile ? 'flex-col' : 'flex-row'}
                rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition hover:shadow-md
              `}
            >
              <div
                className={`
                  ${isMobile ? 'w-full h-48 rounded-t-lg' : 'flex-shrink-0 w-40 h-auto rounded-l-lg'}
                  overflow-hidden
                `}
              >
                <Image
                  src={h.image}
                  alt={h.title}
                  width={0}
                  height={0}
                  sizes={isMobile ? "100vw" : "350px"}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>
              <div className={`${isMobile ? 'p-4 rounded-b-lg flex flex-col items-center text-center' : 'flex-1 p-4 flex flex-col justify-between'}`}>
                <div>
                  <h3 className="text-2xl font-semibold">{h.title}</h3>
                  <p className="text-gray-600 text-sm mt-1 whitespace-pre-line">{h.description}</p>
                </div>
                <a
                  href={h.ticketsUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    mt-4 px-4 py-2 bg-[#001a4a] text-white text-sm font-semibold rounded hover:bg-[#003366] transition
                    ${isMobile ? 'w-full max-w-xs' : 'w-max self-start'}
                  `}
                >
                  TICKETS
                </a>
              </div>
            </div>
          ))}
        </div>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">Past Shows</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mt-14">
          {[
            "/posters/IMG_5539.png",
            "/posters/IMG_5850.jpeg",
            "/posters/IMG_6320.png",
            "/posters/MM Wet January IG (1080 x 1350 px).png",
          ].map((src, idx) => (
            <div key={idx} className="relative overflow-hidden rounded-lg shadow-sm hover:shadow-md transition">
              <Image
                src={src}
                alt={`Poster ${idx + 1}`}
                width={0}
                height={0}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className="w-full h-64 object-contain"
                priority
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;