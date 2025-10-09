"use client";

import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import { CalendarClock, AlarmClockCheck, PauseCircle, Eye } from "lucide-react"; // Use icons relevant to scheduling
import {
  CalendarCheck,
  AlarmClock,
  Hourglass,
} from 'lucide-react';
import { LucideIcon } from "lucide-react";
import GetStartedButton from '@/components/GetStartedButton';

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const EasyScheduling = () => {
    const points: PointCardProps[] = [
    {
      title: "Schedule Ahead",
      description:
        "Set publish dates and times for any content type from product launches to blog posts to campaigns.",
      icon: CalendarClock,
    },
    {
      title: "No Last-Minute Stress",
      description:
        "Automate rollouts so your team can avoid fire drills, especially during holidays or key launches.",
      icon: AlarmClockCheck,
    },
    {
      title: "Total Visibility",
      description:
        "Preview your full content calendar in one place. Know what's going live, when, and where.",
      icon: Eye,
    },
    {
      title: "Pause & Adjust",
      description:
        "Need to delay or revise a go-live? Just pause, edit, and reschedule in seconds.",
      icon: PauseCircle,
    },
  ];
  return (
    <>
      <Head>
        <title>Easy Scheduling | Vivreal</title>
        <meta
          name="description"
          content="Schedule your content with confidence. Vivreal lets you plan, preview, and automate content releases so your team stays ahead and your brand stays consistent."
        />
        <link rel="canonical" href={'https://www.vivreal.io/features/scheduling'} />
      </Head>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
            <div className="bg-purple-50 px-5 md:px-0 py-10 rounded-xl order-2 w-full md:order-1 space-y-6 text-center mx-auto -mb-10">
                <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight animate-fade-in" style={{ animationDelay: '200ms' }}>
                    Plan Content with <span className="text-purple-700">Confidence</span>
                </h1>
                <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg animate-fade-in" style={{ animationDelay: '300ms' }}>
                    Set it and forget it. Vivreal lets your team plan content in advance and automate go-lives with full confidence.
                </p>
                <div className="flex justify-center">
                  <GetStartedButton page="EasyScheduling" color="#7E22CE" />
                </div>
            </div>

            <div className="px-8 text-center">
                <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                    {points.map((point, index) => (
                        <div
                        key={index}
                        className="rounded-xl transition-all text-center"
                        >
                        <point.icon size={28} className="w-8 h-8 text-purple-700 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                        <p className="text-sm text-gray-800">{point.description}</p>
                        </div>
                    ))}
                </div>
            </div>
          <div className="flex w-full flex-col md:flex-row gap-12 mx-auto py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Stay Ahead of the Curve
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Whether you&apos;re launching a campaign or planning seasonal updates, Vivreal helps your team get organized and aligned. No more midnight edits or race-against-the-clock pushes.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Align marketing and product teams around a shared content plan</li>
                <li>Ensure timely go-lives for events, promotions, and launches</li>
                <li>Increase team accountability and reduce manual work</li>
              </ul>
            </div>
            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-purple-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How Scheduling Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <CalendarCheck className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Set a Date</h4>
                      <p className="text-sm text-gray-800">
                        Choose the exact time and date when your content should go live weeks or even months in advance.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <AlarmClock className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Automate Go-Lives</h4>
                      <p className="text-sm text-gray-800">
                        Vivreal automatically publishes your content at the scheduled time no manual action required.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Hourglass className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Focus on Strategy</h4>
                      <p className="text-sm text-gray-800">
                        With content handled in advance, your team can focus on planning, creativity, and long-term growth.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h5 className="text-2xl md:text-3xl font-display font-bold">
              Reliable Rollouts. Reduced Risk.
            </h5>
            <p className="text-gray-800 max-w-3xl mx-auto">
              Easy Scheduling takes the guesswork and stress out of content releases. Your team can work smarter, avoid late nights, and maintain a consistent digital presence without compromise.
            </p>
          </div>
        </section>

        <CTASection page="EasyScheduling" />
      </main>

      <Footer />
    </>
  );
};

export default EasyScheduling;