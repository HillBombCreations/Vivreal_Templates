import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import GetStartedButton from "@/components/GetStartedButton";
import {
  FolderOpen,
  PenLine,
  Share2,
  Upload,
  FileText,
  Database,
} from "lucide-react";
import { LucideIcon } from "lucide-react";

interface PointCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const ContentHub = () => {
  const points: PointCardProps[] = [
    {
      icon: FolderOpen,
      title: "Everything in One Place",
      description:
        "Bring blogs, case studies, media, press kits, and more into a centralized content repository that your team can easily access and update.",
    },
    {
      icon: PenLine,
      title: "Publish with Confidence",
      description:
        "Create and edit content in a structured, brand-safe environment no messy docs or outdated drafts.",
    },
    {
      icon: Share2,
      title: "Reuse Across Channels",
      description:
        "Publish content once and reuse it across your website, email campaigns, social media, or apps.",
    },
    {
      icon: Upload,
      title: "Media Management",
      description:
        "Organize images, videos, and documents with tags and folders, so your team can always find what they need.",
    },
  ];

  return (
    <>
      <Helmet>
        <title>Content Hub | Vivreal Solutions</title>
        <meta
          name="description"
          content="Vivreal's Content Hub helps your team manage blogs, media, and all your digital assets in one place. Keep everything organized, updated, and ready to publish without the chaos."
        />
        <link rel="canonical" href={'https://www.vivreal.io/solutions/content-hub'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-purple-50 py-10 px-5 md:px-0 rounded-xl w-full text-center space-y-6 mx-auto -mb-10">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              One Hub. <span className="text-purple-700">Every Story.</span>
            </h1>
            <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg">
              Whether it's blogs, case studies, press releases, or media Vivreal keeps all your content organized, accessible, and publish-ready.
            </p>
            <div className="flex justify-center">
              <GetStartedButton page="ContentHub" color="purple-700" />
            </div>
          </div>
          <div className="text-center">
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {points.map((point, index) => (
                <div key={index} className="rounded-xl transition-all text-center">
                  <point.icon size={28} className="w-8 h-8 text-purple-700 mx-auto mb-4" />
                  <h2 className="text-lg font-semibold mb-2">{point.title}</h2>
                  <p className="text-sm text-gray-800">{point.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col md:flex-row gap-12 py-10">
            <div className="w-full md:w-3/5 space-y-8">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-center md:text-left">
                Content that Works as Hard as You Do
              </h2>
              <p className="text-gray-800 text-center md:text-left">
                Content Hub lets your team centralize creation, updates, and distribution all without relying on developers. Move faster, stay on brand, and ensure your latest content is always live and accurate.
              </p>
              <ul className="list-disc pl-6 text-gray-800 space-y-2">
                <li>Eliminate duplicate content workflows</li>
                <li>Keep your brand consistent across every channel</li>
                <li>Save time with reusable, structured content blocks</li>
              </ul>
            </div>
            <div className="w-full md:w-2/5 space-y-8">
              <div className="bg-white border border-purple-700 rounded-xl px-6 py-6 shadow-sm space-y-6">
                <h3 className="text-2xl font-semibold">How It Works</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <FileText className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">1. Create</h4>
                      <p className="text-sm text-gray-800">
                        Draft structured content using custom fields ready for blogs, press releases, or even product copy.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Database className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">2. Organize</h4>
                      <p className="text-sm text-gray-800">
                        Store content and media in collections with tags, filters, and user access settings.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Share2 className="w-6 h-6 text-purple-700 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">3. Distribute</h4>
                      <p className="text-sm text-gray-800">
                        Share your content wherever you need from your website to your mobile app with full control over formatting and timing.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6 text-center bg-secondary/50 px-5 py-10 rounded-xl">
            <h2 className="text-2xl md:text-3xl font-display font-bold">
              A Smarter Way to Manage Content
            </h2>
            <p className="text-gray-800 max-w-3xl mx-auto">
              Vivreal's Content Hub simplifies how your team creates, organizes, and publishes content so you can keep up with your audience and stay focused on what matters most.
            </p>
          </div>
        </section>

        <CTASection page="ContentHub" />
      </main>

      <Footer />
    </>
  );
};

export default ContentHub;