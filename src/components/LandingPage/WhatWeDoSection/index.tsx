"use client";

import { FC } from "react";
import Link from "next/link";
import { Sparkles, Globe, BarChart2, ArrowRight } from "lucide-react";

const genericFeatures = [
  {
    title: "Creative Design",
    description:
      "From branding to user interfaces, we craft designs that are both functional and beautiful.",
    icon: Sparkles,
  },
  {
    title: "Technology Solutions",
    description:
      "We build scalable, adaptable systems to help you stay ahead in a fast-moving world.",
    icon: Globe,
  },
  {
    title: "Strategy & Growth",
    description:
      "With data-driven insights, we help organizations make smarter decisions and grow with confidence.",
    icon: BarChart2,
  },
];

const WhatWeDoSection: FC = () => {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden bg-gradient-to-b from-white to-secondary/40">
      <div className="mx-auto max-w-6xl px-6 text-center">
        {/* Heading */}
        <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-12">
          What <span className="text-primary">We Do</span>
        </h2>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-10">
          {genericFeatures.map((feature, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center transition hover:shadow-md"
            >
              <feature.icon className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-gray-600 mt-2">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link
          href="/what-we-do"
          className="inline-flex items-center gap-2 font-medium text-primary hover:underline group"
        >
          Learn more
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
};

export default WhatWeDoSection;