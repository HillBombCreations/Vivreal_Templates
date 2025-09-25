import { useState } from "react";
import { ArrowRight, Zap, Users, Server, ShieldCheck } from "lucide-react";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const features: FeatureCard[] = [
  {
    id: "fast-api",
    title: "Blazing Speed Delivery",
    description:
      "Ensure your content reaches your audience instantly, keeping your business agile and responsive to market demands.",
    Icon: Zap,
  },
  {
    id: "team-collab",
    title: "Seamless Teamwork",
    description:
      "Break down silos with tools that keep marketing, development, and editorial teams aligned and efficient.",
    Icon: Users,
  },
  {
    id: "scalable-infra",
    title: "Effortless Growth",
    description:
      "Scale your content infrastructure effortlessly as your business expands, ensuring consistent performance at every stage.",
    Icon: Server,
  },
  {
    id: "advanced-security",
    title: "Rock-Solid Security",
    description:
      "Protect your data and content with enterprise-grade security protocols designed to safeguard your business continuity.",
    Icon: ShieldCheck,
  },
];

const SolutionsSection = () => {
  const [activeFeature, setActiveFeature] = useState<string>("fast-api");

  return (
    <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden bg-gradient-to-b from-secondary/40 to-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold max-w-xl tracking-tight leading-tight">
            <span className="text-primary">Solutions built for scale</span> enabling your team to move faster and smarter.
          </h2>
          <a
            href="/solutions"
            className="mt-6 md:mt-0 inline-flex items-center text-primary font-semibold hover:underline"
          >
            Explore solutions <ArrowRight className="ml-2 w-5 h-5" />
          </a>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map(({ id, title, description, Icon }) => {
            const isActive = id === activeFeature;
            return (
              <div
                key={id}
                onClick={() => setActiveFeature(id)}
                className="group rounded-2xl p-6 transition-all duration-300 border border-primary bg-white"
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold">{title}</h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SolutionsSection;