import { Helmet } from 'react-helmet';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';
import { BarChart2, PieChart, LineChart, Activity } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import GetStartedButton from "@/components/GetStartedButton";

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const DataAnalytics = () => {
  const points: PointCardProps[] = [
    {
      title: "Track Team Activity",
      description:
        "Monitor how your team uses Vivreal see who's creating, publishing, and engaging with content.",
      icon: Activity,
    },
    {
      title: "Content Growth Metrics",
      description:
        "Understand trends in content creation, updates, and media uploads across your workspace.",
      icon: LineChart,
    },
    {
      title: "Integration Insights",
      description:
        "See which external tools and APIs are actively in use across your projects and teams.",
      icon: BarChart2,
    },
    {
      title: "Dashboard Overview",
      description:
        "Get a high-level snapshot of all Vivrecords, users, and assets from one centralized dashboard.",
      icon: PieChart,
    },
  ];

  return (
    <>
      <Helmet>
        <title>Data Analytics | Vivreal</title>
        <meta
          name="description"
          content="Get full visibility into your content and team activity with Vivreal's built-in analytics. Understand performance, usage, and growth without external tools."
        />
        <link rel="canonical" href={'https://www.vivreal.io/features/data-analytics'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-red-50 py-10 px-5 md:px-0 rounded-xl order-2 w-full md:order-1 space-y-6 text-center mx-auto -mb-10">
            <h1
              className="text-3xl md:text-5xl w-full font-display font-bold tracking-tight animate-fade-in"
              style={{ animationDelay: '200ms' }}
            >
              Measure What <span className="text-red-700">Matters</span>
            </h1>
            <p
              className="inline-block text-gray-800 max-w-4xl text-md md:text-lg animate-fade-in"
              style={{ animationDelay: '300ms' }}
            >
              Vivreal gives you built-in visibility into platform usage, content performance, and team activity all from a single dashboard.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="DataAnalytics" color="red-700" />
            </div>
          </div>
          <div className="px-8 text-center">
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
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
          </div>

          <div className="flex w-full flex-col md:flex-row gap-12 mx-auto py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Analytics Built for Content Teams
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                No need for third-party tools or spreadsheets. Vivreal gives your team instant visibility into what's working and what's not so you can iterate, align, and grow faster.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Understand how content is created and consumed</li>
                <li>Identify top-performing teams and workflows</li>
                <li>Make data-backed decisions to optimize processes</li>
              </ul>
            </div>

            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-red-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How Analytics Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <BarChart2 className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Capture Platform Data</h4>
                      <p className="text-sm text-gray-800">
                        Vivreal automatically tracks team activity, content changes, media uploads, and integration usage.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <PieChart className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. View Your Dashboard</h4>
                      <p className="text-sm text-gray-800">
                        Access analytics directly in your dashboard no setup, no extra tools, just insights that matter.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <LineChart className="w-6 h-6 text-red-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Take Action</h4>
                      <p className="text-sm text-gray-800">
                        Use real-time insights to guide content planning, team resourcing, and optimization efforts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wrap-up Section */}
          <div className="space-y-6 text-center bg-secondary/50 mx-auto px-5 md:px-0 py-10 rounded-xl">
            <h4 className="text-2xl md:text-3xl font-display font-bold">
              Smarter Teams. Better Decisions.
            </h4>
            <p className="text-gray-800 max-w-3xl mx-auto">
              Data Analytics gives you the clarity you need to scale with confidence. No guesswork just the metrics that help your team do their best work.
            </p>
          </div>
        </section>

        <CTASection page="DataAnalytics" />
      </main>

      <Footer />
    </>
  );
};

export default DataAnalytics;
