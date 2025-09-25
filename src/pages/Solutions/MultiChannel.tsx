import { Helmet } from 'react-helmet';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import GetStartedButton from '@/components/GetStartedButton';
import {
  Send,
  MonitorSmartphone,
  RefreshCw,
  Palette,
  Target,
  Share2,
  BarChart3,
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const Multichannel = () => {
  const points: PointCardProps[] = [
    {
      icon: MonitorSmartphone,
      title: "One Message, Many Channels",
      description:
        "Create content once and publish it across your website, email, landing pages, and apps all from a single platform.",
    },
    {
      icon: Palette,
      title: "Stay On Brand Everywhere",
      description:
        "Templates and structured components ensure that every channel looks and feels consistent, no matter who's publishing.",
    },
    {
      icon: Send,
      title: "Launch Faster",
      description:
        "Skip the back-and-forth. Publish campaigns across channels instantly without waiting on engineering.",
    },
    {
      icon: RefreshCw,
      title: "Update in Real-Time",
      description:
        "Make a change once and see it reflected everywhere no manual rework or reuploads required.",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Multi-Channel Marketing | Vivreal Solutions</title>
        <meta
          name="description"
          content="Deliver your message everywhere fast. Vivreal helps marketing teams launch cross-channel campaigns, stay on brand, and move faster with less effort."
        />
        <link rel="canonical" href={'https://www.vivreal.io/solutions/multichannel'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-red-50 px-5 md:px-0 py-10 rounded-xl w-full space-y-6 text-center mx-auto -mb-10">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              One Platform. <span className="text-red-700">All Channels</span>
            </h1>
            <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg">
              Vivreal makes it easy to keep your message aligned across every digital touchpoint without slowing your team down.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="MultiChannel" color="red-700" />
            </div>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4 text-center">
            {points.map((point, index) => (
              <div
                key={index}
                className="rounded-xl transition-all text-center"
              >
                <point.icon size={28} className="w-8 h-8 text-red-700 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                <p className="text-sm text-gray-800">{point.description}</p>
              </div>
            ))}
          </div>

          <div className="flex w-full flex-col md:flex-row gap-12 py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Reach Your Audience Wherever They Are
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Campaigns today span multiple channels. Vivreal brings everything together so your team can move faster, stay consistent, and scale marketing efforts with less manual work.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Plan and manage cross-channel campaigns in one place</li>
                <li>Eliminate content silos across teams and platforms</li>
                <li>Keep your messaging consistent and compliant</li>
              </ul>
            </div>
            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-red-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How It Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Target className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Define Your Message</h4>
                      <p className="text-sm text-gray-800">
                        Create structured content headlines, CTAs, imagery that's ready to be reused across channels.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Share2 className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Distribute Everywhere</h4>
                      <p className="text-sm text-gray-800">
                        Publish to your website, email platform, and customer portal simultaneously with just a few clicks.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <BarChart3 className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Analyze & Optimize</h4>
                      <p className="text-sm text-gray-800">
                        Track performance across all platforms and refine your messaging without rebuilding everything from scratch.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              A Smarter Way to Go Multi-Channel
            </h2>
            <p className="text-gray-800 max-w-3xl mx-auto">
              Vivreal gives your marketing team the power to launch cross-channel campaigns with confidence. Fewer tools, fewer blockers just a streamlined path from idea to impact.
            </p>
          </div>
        </section>

        <CTASection page="Multichannel" />
      </main>

      <Footer />
    </>
  );
};

export default Multichannel;