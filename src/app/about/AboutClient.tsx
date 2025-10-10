"use client";

import Image from "next/image";
import Link from "next/link";
import { useSiteData } from "@/contexts/SiteDataContext";
import GetStartedButton from "@/components/GetStartedButton";
import {
  Users,
  Heart,
  Globe,
  TrendingUp,
  ArrowRight,
  Target,
} from "lucide-react";

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

const funFacts = [
  { number: "10+", label: "Years of combined experience" },
  { number: "50+", label: "Projects launched" },
  { number: "100%", label: "Commitment to quality" },
];

const AboutClient = () => {
  const siteData = useSiteData();

  return (
    <main className="pt-24 md:pt-32">
      <section className="mx-auto max-w-5xl px-6 text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold font-display">
          About <span className="text-primary">Our Company</span>
        </h1>
        <p
          style={{ color: siteData?.["text-primary"] }}
          className="max-w-2xl mx-auto text-lg md:text-xl"
        >
          We’re a team of builders, dreamers, and doers on a mission to help
          people create meaningful digital experiences. Our approach blends
          professionalism with creativity — because work should be fun.
        </p>
      </section>
      <section className="mx-auto max-w-6xl px-6 mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
          Our Core Values
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((val, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${siteData?.primary}`,
                background: siteData?.surface,
              }}
              className="rounded-xl p-6 flex flex-col items-center text-center space-y-3 shadow-sm"
            >
              <val.icon
                className="w-8 h-8"
                style={{ color: siteData?.["text-primary"] }}
              />
              <h3 className="text-lg font-semibold">{val.title}</h3>
              <p
                style={{ color: siteData?.["text-secondary"] }}
                className="text-sm"
              >
                {val.description}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 mt-24">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
          Meet the Team
        </h2>
        <p
          className="text-center max-w-2xl mx-auto mb-12"
          style={{ color: siteData?.["text-primary"] }}
        >
          Behind every product is a passionate team. Here’s a glimpse of the
          people who make it possible.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[1, 2, 3, 4].map((num) => (
            <div
              key={num}
              className="flex flex-col items-center space-y-4 text-center"
            >
              <Image
                src={`/team${num}.png`}
                alt={`Team member ${num}`}
                width={200}
                height={200}
                className="rounded-full object-cover"
              />
              <h3 className="font-semibold">Team Member {num}</h3>
              <p
                className="text-sm"
                style={{ color: siteData?.["text-secondary"] }}
              >
                Role / Short Bio
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 mt-24 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">A Few Fun Facts</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {funFacts.map((fact, i) => (
            <div
              key={i}
              style={{
                background: siteData?.surface,
                border: `1px solid ${siteData?.primary}`,
              }}
              className="rounded-xl p-8"
            >
              <p className="text-3xl font-bold text-primary">{fact.number}</p>
              <p
                className="text-sm mt-2"
                style={{ color: siteData?.["text-secondary"] }}
              >
                {fact.label}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-24 mx-auto max-w-4xl text-center px-6">
        <div className="space-y-6 bg-secondary/50 px-6 py-12 rounded-xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Ready to Learn More?
          </h2>
          <p
            className="text-sm max-w-xl mx-auto"
            style={{ color: siteData?.["text-secondary"] }}
          >
            Every journey starts with a conversation. Reach out today and see
            how we can work together to bring your ideas to life.
          </p>
        </div>
      </section>
    </main>
  );
};

export default AboutClient;