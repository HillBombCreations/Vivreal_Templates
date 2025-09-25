import { Helmet } from 'react-helmet';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import { Zap, Edit3, Rocket } from 'lucide-react';
import { UserCheck, Clock, Globe } from 'lucide-react';
import GetStartedButton from '@/components/GetStartedButton';

const QuickUpdates = () => {
  const features = [
    {
      title: "No Developer Needed",
      description:
        "Marketing and content teams can publish instantly without waiting on engineers.",
      icon: UserCheck,
    },
    {
      title: "Real-Time Publishing",
      description:
        "Go live in seconds with just a few clicks. Keep your site relevant and up to date around the clock.",
      icon: Clock,
    },
    {
      title: "Centralized Updates",
      description:
        "Update once and publish everywhere from your homepage to product pages to help docs.",
      icon: Globe,
    },
  ];
  return (
    <>
      <Helmet>
        <title>Quick Updates | Vivreal</title>
        <meta
          name="description"
          content="Update your content instantly with Vivreal's intuitive editing tools. Empower business teams to move faster and keep your brand relevant without needing developer help."
        />
        <link rel="canonical" href={'https://www.vivreal.io/features/quick-updates'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-blue-50 px-5 md:px-0 py-10 rounded-xl text-center space-y-6">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Update Content in <span className="text-blue-700">Seconds</span>
            </h1>
            <p className="text-gray-800 max-w-3xl mx-auto text-md md:text-lg">
              Vivreal gives business teams the freedom to make site changes quickly no tickets, no developers, no bottlenecks.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="QuickUpdates" color="blue-700" />
            </div>
          </div>
          <div className="mx-auto text-center">
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {features.map((point, index) => (
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
                Built for Speed. Designed for Business.
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Vivreal makes it easy to manage content updates at scale. Whether you're launching campaigns, updating product info, or fixing typos your team can act fast without slowing down development cycles.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Launch faster with fewer approvals and blockers</li>
                <li>Empower non-technical roles to take ownership</li>
                <li>Keep messaging and branding consistent across all touchpoints</li>
              </ul>
            </div>

            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-blue-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How It Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Zap className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Click</h4>
                      <p className="text-sm text-gray-800">
                        Select any content item from your collection blog, job post, product, or more.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Edit3 className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Edit</h4>
                      <p className="text-sm text-gray-800">
                        Update copy, links, images, or metadata using a simple and powerful editor.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Rocket className="w-6 h-6 text-blue-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Publish</h4>
                      <p className="text-sm text-gray-800">
                        Save and publish changes instantly across your entire site or app.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h5 className="text-2xl md:text-3xl font-display font-bold">Move at the Speed of Your Business</h5>
            <p className="text-gray-800 max-w-3xl mx-auto">
              With Vivreal, you don't need to wait days or even hours to update your site. Quick updates give your team the autonomy to move faster, improve time-to-market, and keep your digital presence fresh at all times.
            </p>
          </div>
        </section>

        <CTASection page="QuickUpdates" />
      </main>

      <Footer />
    </>
  );
};

export default QuickUpdates;