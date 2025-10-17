"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, Globe, Users, BarChart2 } from "lucide-react";
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
      description: "Hotshots! A comedy showcase featuring a blend of Chicago's finest alongside the next generation of household names. This is a must see show",
      image: '/hotshots.jpeg',
    }
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
          </div>
        </div>
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-16 tracking-tight">Upcoming Shows</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-6 text-center">
          {highlights.map((h, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md justify-center items-center flex flex-col"
            >
              <Image
                src={h.image}
                alt="Hero illustration"
                width={200}
                height={100}
                className="h-auto object-contain"
                priority
              />
              <h3 className="text-lg font-semibold">{h.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{h.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;