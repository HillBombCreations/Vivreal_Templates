import Head from "next/head";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { Users, Clock, BarChart2, ClipboardList, Target, Globe, Sparkles } from "lucide-react";
import { siteData } from "@/data/mockData";

const WhatWeDoPage = async () => {
  return (
    <>
      <Head>
        <title>What We Do | Template</title>
        <meta
          name="description"
          content="Learn about what we do: our focus areas, how we work, and the value we bring."
        />
        <link rel="canonical" href={"/what-we-do"} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-auto max-w-5xl px-6 text-center space-y-6 mb-20">
          <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
            What We Do
          </h1>
          <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
            We help teams bring ideas to life through thoughtful design,
            innovative technology, and a collaborative spirit. Our approach is
            modern, flexible, and built to scale with you.
          </p>
        </section>
        <section className="mx-auto max-w-6xl px-6 mb-24">
          <div className="grid gap-8 md:grid-cols-3">
            {[
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
            ].map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center transition hover:shadow-md"
              >
                <item.icon style={{ color: siteData?.primary }} className="w-10 h-10 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600 mt-2">{item.description}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 mb-24 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              How We Work
            </h2>
            <p className="text-gray-700">
              Collaboration and clarity guide everything we do. From the first
              conversation to final delivery, we focus on aligning with your
              goals and creating real value.
            </p>
            <ul className="space-y-3 text-gray-700 list-disc list-inside">
              <li>Collaborative and transparent process</li>
              <li>Flexible solutions tailored to your needs</li>
              <li>Attention to detail and long-term value</li>
            </ul>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                title: "Plan",
                desc: "We start by understanding your goals and mapping a clear path forward.",
                icon: ClipboardList,
              },
              {
                title: "Create",
                desc: "Our team designs and builds with creativity and technical expertise.",
                icon: Users,
              },
              {
                title: "Deliver",
                desc: "We ensure a smooth launch and provide support every step of the way.",
                icon: Clock,
              },
              {
                title: "Evolve",
                desc: "Your needs change, and we adapt solutions that grow with you.",
                icon: Target,
              },
            ].map((step, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <step.icon style={{ color: siteData?.primary }} className="w-6 h-6 mb-2" />
                <h4 className="font-semibold">{step.title}</h4>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-6 mb-24 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-8">
            The Value We Bring
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { stat: "10+", label: "Years of Experience" },
              { stat: "100+", label: "Projects Completed" },
              { stat: "∞", label: "Ideas & Possibilities" },
            ].map((fact, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
              >
                <p className="text-3xl font-bold" style={{ color: siteData?.primary }}>{fact.stat}</p>
                <p className="text-sm text-gray-600 mt-2">{fact.label}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-4xl px-6 text-center space-y-6 bg-secondary/50 pt-12 rounded-xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Ready to Work Together
          </h2>
          <p className="text-gray-700 max-w-2xl mx-auto">
            We believe in building lasting partnerships and creating solutions
            that inspire. Let’s shape the future — together.
          </p>
        </section>
      </main>

      <CTASection />
      <Footer />
    </>
  );
};

export default WhatWeDoPage;

export const generateMetadata = async () => {
  return {
    title: "What We Do",
    description:
      "Learn about what we do: our focus areas, how we work, and the value we bring.",
    openGraph: {
      title: "What We Do",
      description:
        "Learn about what we do: our focus areas, how we work, and the value we bring.",
      url: "https://thecomedycollective.com/what-we-do",
      images: [
        {
          url: "/what-we-do-meta.png",
          width: 1200,
          height: 630,
          alt: "What We Do",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "What We Do",
      description:
        "Learn about what we do: our focus areas, how we work, and the value we bring.",
      images: ["/what-we-do-meta.png"],
    },
  };
};