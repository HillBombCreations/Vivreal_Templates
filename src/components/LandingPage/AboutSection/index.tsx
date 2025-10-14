"use client";

import Link from "next/link";
import { Users, Heart, Globe, TrendingUp, ArrowRight } from "lucide-react";
import { siteData } from "@/data/mockData";

const values = [
  {
    title: "People First",
    description: "We put people at the center of everything we build.",
    icon: Users,
  },
  {
    title: "Driven by Passion",
    description: "We love what we do and it fuels our creativity daily.",
    icon: Heart,
  },
  {
    title: "Global Mindset",
    description: "Our solutions are made to connect audiences worldwide.",
    icon: Globe,
  },
  {
    title: "Always Growing",
    description: "We learn, adapt, and improve continuously.",
    icon: TrendingUp,
  },
];

const AboutSection = () => {
  return (
    <section className="relative py-20 md:py-28 bg-gradient-to-b from-white to-secondary/40">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            About Your Brand
          </h2>
          <p className="text-gray-700 text-lg md:text-xl">
           Write a short paragraph introducing your brand or team. Share what you do, what drives you, and what makes your work unique. Keep it friendly, professional, and true to your mission.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {values.map((val, i) => (
            <div
              key={i}
              className="rounded-xl p-6 bg-white border border-gray-200 shadow-sm flex flex-col items-center text-center space-y-3 hover:shadow-md transition"
            >
              <val.icon style={{ color: siteData?.primary }} className="w-8 h-8" />
              <h3 className="text-lg font-semibold">{val.title}</h3>
              <p className="text-sm text-gray-600">{val.description}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link
            href="/about"
            style={{ color: siteData?.primary }}
            className="inline-flex items-center gap-2 font-medium hover:underline group"
          >
            Learn more
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AboutSection;