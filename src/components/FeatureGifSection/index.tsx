"use client";

import { useState, useEffect, FC } from "react"
import { 
  ArrowRight,
} from "lucide-react"
import clsx from "clsx"
import { FeatureGifSectionProps } from "@/types/LandingPage/FeatureGifSection";
import { iconMap } from "@/lib/utils";

const FeaturesGifSection: FC<FeatureGifSectionProps> = (props) => {
  const { featureGifSection, siteData } = props;
  const [activeTab, setActiveTab] = useState(featureGifSection?.features[0].id)
  const [isMobile, setIsMobile] = useState(false);
  const currentTab = featureGifSection?.features.find((tab) => tab.id === activeTab);
  const resolvedFeatures = featureGifSection?.features?.length
    ? featureGifSection.features.map((feature) => ({
      ...feature,
      icon: iconMap[feature.iconString] || (() => null),
    })) : [];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <section className={`py-16 md:py-28`} style={{ backgroundColor: siteData?.surface }}>
      <div className="w-[80%] mx-auto sm:px-6">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            Platform <span style={{ color: siteData?.["text-primary"] }}>Features</span>
          </h2>
          <p className="text-base sm:text-lg mt-2 max-w-md mx-auto text-gray-600">
            Powerful tools to streamline your workflow and scale operations.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12">
          {resolvedFeatures.map((feature) => {
            const Icon = feature.icon
            return (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-3 cursor-pointer rounded-full text-sm sm:text-base font-medium transition shadow",
                  activeTab === feature.id
                    ? "bg-white"
                    : "bg-muted text-gray-800 hover:bg-muted/70"
                )}
                style={
                  activeTab === feature.id
                    ?
                    {
                      background: siteData?.surface,
                      border: `2px solid ${feature?.color}`,
                      color: siteData?.["text-primary"],
                    }
                    :
                    {
                      background: siteData?.["surface-alt"],
                      border: `2px solid ${feature.color}80`,
                      color: 'text-gray-700',
                    }
                }
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: activeTab === feature.id ? feature.color : `${feature.color}80`,
                  }}
                />
                {feature.title}
              </button>

            )
          })}
        </div>
        <div className="grid md:grid-cols-[1fr_1.5fr] gap-8 w-full items-start">
          <div className="rounded-3xl h-full transition-all animate-fade-in">
            {currentTab && (
              <div
                className="rounded-3xl px-6 py-6 h-full flex flex-col"
                style={{
                  border: `2px solid ${currentTab.color}`,
                  background: siteData?.surface,
                }}
              >
                <div className="pt-4">
                  <h3
                    style={{ color: siteData?.["text-primary"] }}
                    className="text-2xl md:text-3xl leading-snug"
                  >
                    {currentTab.title}
                  </h3>
                  <p
                    style={{ color: siteData?.["text-secondary"] }}
                    className="text-base sm:text-lg leading-relaxed font-medium mt-2"
                  >
                    {currentTab.description}
                  </p>
                </div>
                <div className="mt-4 md:mt-auto">
                  <a
                    href={currentTab.path}
                    style={{ color: currentTab.color }}
                    className="inline-flex items-center gap-2 text-md hover:underline"
                  >
                    Explore {currentTab.title} <ArrowRight className="w-5 h-5" />
                  </a>
                </div>
              </div>
            )}
          </div>
          {!isMobile && currentTab && (
              <video
              src={currentTab.gif}
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
  )
};

export default FeaturesGifSection;