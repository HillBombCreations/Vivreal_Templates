"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Sparkles, Globe, Users, BarChart2 } from "lucide-react";
import { siteData } from "@/data/mockData";

const genericFeatures = [
  {
    id: "feature1",
    title: "Feature One",
    description:
      "A clear and concise description that explains the value of this feature in simple terms.",
    icon: Sparkles,
    media: "/easyScheduling.mp4",
  },
  {
    id: "feature2",
    title: "Feature Two",
    description:
      "Showcase how this capability helps teams or individuals work smarter and faster.",
    color: "#9333EA", // purple
    icon: Globe,
    media: "/dataAnalytics.mp4",
  },
  {
    id: "feature3",
    title: "Feature Three",
    description:
      "Highlight an area that demonstrates innovation and a modern approach.",
    icon: BarChart2,
    media: "/orderAnalytics.mp4",
  },
  {
    id: "feature4",
    title: "Feature Four",
    description:
      "Emphasize collaboration, growth, or another universal business need.",
    icon: Users,
    media: "/quickUpdatesV2.mp4",
  },
];

const FeaturesGifSection = () => {
  const [activeTab, setActiveTab] = useState(genericFeatures[0].id);
  const [isMobile, setIsMobile] = useState(false);

  const currentTab = genericFeatures.find((tab) => tab.id === activeTab);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <section className="py-16 md:py-28 bg-white">
      <div className="w-[85%] mx-auto sm:px-6">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            Platform <span className="text-primary">Features</span>
          </h2>
          <p className="text-base sm:text-lg mt-2 max-w-md mx-auto text-gray-600">
            Explore some of the key areas you can highlight in your product or service.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12">
          {genericFeatures.map((feature) => {
            const Icon = feature.icon;
            return (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={`flex cursor-pointer items-center gap-2 px-5 py-3 rounded-full text-sm sm:text-base font-medium transition shadow 
                  ${
                    activeTab === feature.id
                      ? "bg-white border-2"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                style={
                  activeTab === feature.id
                    ? { borderColor: siteData?.primary, color: siteData?.primary }
                    : {}
                }
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: activeTab === feature.id ? siteData?.primary : siteData?.["text-secondary"],
                  }}
                />
                {feature.title}
              </button>
            );
          })}
        </div>
        <div className="grid md:grid-cols-[1fr_1.5fr] gap-8 w-full items-start">
          <div className="rounded-3xl h-full transition-all animate-fade-in">
            {currentTab && (
              <div
                className="rounded-3xl px-6 py-6 h-full flex flex-col"
                style={{
                  border: `2px solid ${siteData?.primary}`,
                  background: "#fff",
                }}
              >
                <div className="pt-4">
                  <h3
                    style={{ color: siteData?.primary }}
                    className="text-2xl md:text-3xl leading-snug font-bold"
                  >
                    {currentTab.title}
                  </h3>
                  <p className="text-base sm:text-lg leading-relaxed font-medium mt-2 text-gray-700">
                    {currentTab.description}
                  </p>
                </div>
                <div className="mt-4 md:mt-auto">
                  <button
                    className="inline-flex items-center gap-2 text-md font-medium group"
                    style={{ color: siteData?.primary }}
                  >
                    Learn More
                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
          {!isMobile && currentTab && (
            <video
              src={currentTab.media}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto rounded-md"
            />
          )}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGifSection;
