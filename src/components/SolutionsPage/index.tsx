"use client";

import Head from "next/head";
import Navbar from "@/components/Navigation/Navbar";
import Image from "next/image";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import GetStartedButton from "@/components/GetStartedButton";
import { useSiteData } from '@/contexts/SiteDataContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/UI/carousel";
import {
    Globe,
    ShoppingCart,
    Layers,
    ArrowRight,
    Users,
    LucideIcon,
    UserCheck,
    BarChart2,
    Code,
    Megaphone
} from "lucide-react";
import Link from "next/link";

interface SolutionCardProps {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  color: string;
}

const solutions: SolutionCardProps[] = [
  {
    title: "Websites",
    description:
      "Create fast, flexible websites with structured content your team can manage with ease.",
    link: "/solutions/websites",
    icon: Globe,
    color: "blue-700",
  },
  {
    title: "Content Hub",
    description:
      "Bring blogs, posts, and media together your single source of truth for published content.",
    link: "/solutions/content-hub",
    icon: Layers,
    color: "purple-700",
  },
  {
    title: "Multi-Channel Marketing",
    description:
      "Keep your brand consistent across web, email, and apps all from one place.",
    link: "/solutions/multi-channel",
    icon: Megaphone,
    color: "red-700",
  },
  {
    title: "Sell Online",
    description:
      "Launch your online store, take payments, and manage your sales content effortlessly.",
    link: "/solutions/sell-online",
    icon: ShoppingCart,
    color: "green-700",
  },
];

const rolesSupport = [
  {
    title: "Community Manager",
    image: '/communityManager.png',
    icon: Users,
    color: "blue-700",
    benefits: [
      "Keep your community engaged with easy-to-update pages for news, events, and discussions.",
      "Respond to questions or feedback with tools that centralize user interaction.",
      "Stay visible and relevant with dynamic content your audience actually wants to read.",
    ],
  },
  {
    title: "Team Lead",
    icon: UserCheck,
    color: "green-700",
    image: '/teamLead.png',
    benefits: [
      "Assign tasks and content ownership clearly across multiple teams.",
      "Ensure alignment with visual timelines and shared publishing calendars.",
      "Spot bottlenecks early using real-time dashboards and content flow tracking.",
    ],
  },
  {
    title: "Marketing Specialist",
    icon: BarChart2,
    color: "yellow-500",
    image: '/marketingSpecialist.png',
    benefits: [
      "Pivot quickly with editable content that doesn't require dev resources.",
      "Measure campaign performance with granular engagement insights.",
      "Launch updates across all channels in one place from emails to landing pages.",
    ],
  },
  {
    title: "Developer",
    icon: Code,
    color: "purple-700",
    image: '/developers.png',
    benefits: [
      "Use modular APIs and custom components to build fast, extensible features.",
      "Automate content delivery while staying in control of code and integrations.",
      "Save time by empowering non-technical teammates to manage site content safely.",
    ],
  },
];

const SolutionsPage = () => {
    const siteData = useSiteData();
  return (
    <>
      <Head>
        <title>Vivreal Solutions | More Than a CMS</title>
        <link rel="canonical" href={'https://www.vivreal.io/solutions'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
            <div className="bg-blue-50 py-10 rounded-xl w-full space-y-6 text-center mx-auto -mb-10">
                <h1 className="text-3xl md:text-4xl md:text-5xl font-display font-bold tracking-tight animate-fade-in" style={{ animationDelay: "200ms" }}>
                Solutions built for <span className="text-primary">scale</span>
                </h1>
                <p style={{ color: siteData?.['text-primary'], animationDelay: "300ms" }} className="inline-block max-w-4xl text-md md:text-lg animate-fade-in">
                Enable your team to move faster and smarter with the tools and workflows that fit your business.
                </p>
                <div className="flex justify-center">
                  <GetStartedButton page="Solutions" color={siteData?.primary ?? ""} />
                </div>
            </div>
            <div className="grid gap-8 mt-20 md:grid-cols-2">
            {solutions.map((solution, index) => (
                <div key={index} style={{ border: `1px solid ${siteData?.primary}`, background: siteData?.surface }} className={`rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start gap-6`}>
                <solution.icon size={36} className={`text-${solution.color} w-9 h-9`} />
                <div>
                    <h2 className="text-xl font-semibold mb-2">{solution.title}</h2>
                    <p  style={{ color: siteData?.['text-primary'] }} className="text-sm mb-3">{solution.description}</p>
                    <Link
                      href={solution.link}
                      className={`inline-flex items-center gap-1 text-sm text-${solution.color} font-medium hover:underline`}
                    >
                    <span className="sr-only"> about {solution.title}</span>
                    Learn more <ArrowRight className={`w-4 h-4 text-${solution.color}`} />
                    </Link>
                </div>
                </div>
            ))}
            </div>
            <div className="mt-24">
              <h3 className="text-2xl md:text-3xl font-bold md:text-center mb-8">
                  How Vivreal Supports Your <span style={{ color: siteData?.["text-primary"] }} className="text-primary">Role</span>
              </h3>
              <p style={{ color: siteData?.["text-primary"] }} className="md:text-center text-lg max-w-2xl mx-auto mb-12">
                  Whether you&apos;re managing a team, launching a campaign, or building the future Vivreal adapts to your role and workflow.
              </p>
                <div style={{ color: siteData?.["text-secondary"] }} className="md:hidden flex items-center justify-end mb-4 text-sm animate-bounce">
                  Swipe →
                </div>
                <Carousel opts={{ align: "center", loop: true }}>
                    <CarouselContent>
                    {rolesSupport.map((role, index) => (
                        <CarouselItem
                        key={index}
                        className="w-full md:basis-1/1 px-2 py-4 flex justify-center"
                        >
                        <div style={{ border: `1px solid ${siteData?.primary}`, background: siteData?.surface }} className="flex flex-col md:flex-row items-center justify-between gap-10 rounded-xl p-0 w-full max-w-6xl overflow-hidden">

                            {/* Left Content Block */}
                            <div className="md:w-1/2 h-full p-8 space-y-6 flex flex-col justify-center">
                                <div className="flex items-center gap-3">
                                <role.icon style={{ color: siteData?.["text-primary"] }} className="w-6 h-6" />
                                <h3 className="text-2xl font-semibold" style={{ color: siteData?.["text-primary"] }}>{role.title}</h3>
                                </div>
                                <ul className="list-disc list-inside" style={{ color: siteData?.["text-secondary"] }}>
                                {role.benefits.map((benefit, i) => (
                                    <li key={i}>{benefit}</li>
                                ))}
                                </ul>
                            </div>

                            {/* Right Image */}
                            <div className="md:w-1/2">
                                <Image
                                width={600}
                                height={400}
                                src={role.image}
                                alt={role.title}
                                className="w-full h-full object-cover rounded-none"
                                />
                            </div>
                        </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>

                    {/* Carousel Controls */}
                    <div className="flex justify-center gap-4 mt-6">
                    <CarouselPrevious />
                    <CarouselNext />
                    </div>
                </Carousel>
            </div>
            {/* Insights / Growth Section */}
            <div className="mt-20 grid md:grid-cols-3 gap-6 text-center">
                <div style={{ background: siteData?.surface, border: `1px solid ${siteData?.primary}` }} className="rounded-lg p-6">
                <h3 className="font-semibold text-lg">Flexible Content Modeling</h3>
                <p className="text-sm" style={{ color: siteData?.["text-secondary"] }}>
                    Customize data structures that mirror how your business actually works.
                </p>
                </div>
                <div style={{ background: siteData?.surface, border: `1px solid ${siteData?.primary}` }} className="rounded-lg p-6">
                <h3 className="font-semibold text-lg">Omnichannel Ready</h3>
                <p className="text-sm" style={{ color: siteData?.["text-secondary"] }}>
                    Deliver structured content to websites, apps, portals, and beyond.
                </p>
                </div>
                <div style={{ background: siteData?.surface, border: `1px solid ${siteData?.primary}` }} className="rounded-lg p-6">
                <h3 className="font-semibold text-lg">Collaboration Built-In</h3>
                <p className="text-sm" style={{ color: siteData?.["text-secondary"] }}>
                    Empower teams to work together seamlessly with roles and real-time workflows.
                </p>
                </div>
            </div>
           <div className="space-y-4 bg-secondary/50 px-5 py-10 rounded-xl text-center">
                <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
                    Built to Fit Your Workflow
                </h2>
                <p className="text-sm" style={{ color: siteData?.["text-secondary"] }}>
                    Every team is different. Reach out to explore how Vivreal can support your goals with flexible, scalable solutions.
                </p>
                <Link
                    href="/contact"
                    style={{ background: siteData?.primary, color: siteData?.["text-inverse"] }}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-md transition text-sm font-medium"
                >
                    Contact Us
                    <ArrowRight className="w-4 h-4" />
                </Link>
          </div>
        </section>
      </main>

      <CTASection page="" />
      <Footer />
    </>
  );
};

export default SolutionsPage;