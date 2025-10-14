"use client";

import { useEffect, useState } from "react";
import GetStartedButton from "../../GetStartedButton";
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
      title: "Modern Design",
      description: "A clean, responsive experience that looks great on any device.",
      icon: Sparkles,
    },
    {
      title: "Built for Growth",
      description: "Scalable solutions to grow alongside your business or project.",
      icon: BarChart2,
    },
    {
      title: "Global Reach",
      description: "Deliver your ideas and products to audiences everywhere.",
      icon: Globe,
    },
    {
      title: "Collaboration Ready",
      description: "Work together seamlessly with tools designed for teams.",
      icon: Users,
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
          <div className="space-y-6 text-center sm:text-left">
            <h1
              id="hero-heading"
              className="text-4xl lg:text-5xl font-display font-bold tracking-tight"
            >
              Welcome to <span className="text-primary">Your Platform</span>
            </h1>
            <p className="text-gray-700 text-lg md:text-xl max-w-xl mx-auto sm:mx-0">
              A modern and flexible starting point to showcase your brand, connect with your audience, and grow online.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center sm:justify-start">
              <GetStartedButton color="var(--primary)" />
            </div>
          </div>
          <div className="relative">
            <Image
              src="/placeHolderHeroImage.png"
              alt="Hero illustration"
              width={600}
              height={400}
              className="w-full h-auto object-contain"
              priority
            />
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16 text-center">
          {highlights.map((h, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <h.icon style={{ color: siteData?.primary }} className="w-8 h-8 mx-auto mb-3" />
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