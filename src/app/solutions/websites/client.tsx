"use client";

import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import GetStartedButton from '@/components/GetStartedButton';
import {
  LayoutTemplate,
  MousePointerClick,
  FileText,
  RefreshCw
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const Websites = () => {
  const points: PointCardProps[] = [
    {
      icon: LayoutTemplate,
      title: "Update Without Developers",
      description:
        "Your marketing or content team can publish pages, swap images, and tweak text without needing engineering help.",
    },
    {
      icon: MousePointerClick,
      title: "Keep Everything On-Brand",
      description:
        "Use reusable layouts and structured templates to ensure consistency across every page, every time.",
    },
    {
      icon: FileText,
      title: "Organize Content Easily",
      description:
        "Store everything from headlines to hero images in one place, and manage them with simple workflows.",
    },
    {
      icon: RefreshCw,
      title: "Scale With Your Business",
      description:
        "Whether you're managing one site or several, Vivreal makes it easy to grow without rebuilding your system.",
    },
  ];

  return (
    <>
      <Head>
        <title>Websites | Vivreal Solutions</title>
        <meta
          name="description"
          content="Manage your business website with ease using Vivreal's headless CMS. Update content faster, stay on brand, and free up your developers for high-impact work."
        />
        <link rel="canonical" href={'https://www.vivreal.io/solutions/website'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-blue-100 px-5 md:px-0 py-10 rounded-xl w-full space-y-6 text-center mx-auto -mb-10">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Power Your Website <span className="text-blue-700">Without the Bottlenecks</span>
            </h1>
            <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg">
              With Vivreal, your business can update content across websites in real-time without depending on a dev team.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="WebSites" color="#1D4ED8" />
            </div>
          </div>
          <div className="text-center">
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {points.map((point, index) => (
                <div
                  key={index}
                  className="rounded-xl transition-all text-center"
                >
                  <point.icon size={28} className="w-8 h-8 text-blue-700 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                  <p className="text-sm text-gray-800">{point.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col md:flex-row gap-12 py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Websites That Work for Your Business
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Whether you&apos;re launching a new product page, updating a blog, or refreshing your homepage Vivreal gives you the tools to do it quickly and reliably.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Make website updates in minutes, not days</li>
                <li>Empower marketing to own content without dev blockers</li>
                <li>Ensure brand consistency with structured layouts</li>
              </ul>
            </div>

            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-blue-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How It Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <LayoutTemplate className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Create Templates</h4>
                      <p className="text-sm text-gray-800">
                        Developers set up flexible, reusable page templates so your team can update content safely.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <FileText className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Add Content</h4>
                      <p className="text-sm text-gray-800">
                        Editors add headlines, images, and calls-to-action no code required.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <RefreshCw className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Publish Instantly</h4>
                      <p className="text-sm text-gray-800">
                        Changes go live right away or on a schedule, all controlled from one intuitive dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              Your Website, Your Control
            </h2>
            <p className="text-gray-800 max-w-3xl mx-auto">
              Vivreal turns your website into a living, evolving part of your business. Update faster, stay on brand, and reduce dependency on developers all from a central platform designed for scale.
            </p>
          </div>
        </section>

        <CTASection page="Websites" />
      </main>

      <Footer />
    </>
  );
};

export default Websites;
