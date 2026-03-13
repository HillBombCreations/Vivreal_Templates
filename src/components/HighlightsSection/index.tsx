import { Mic, Users, MapPin } from "lucide-react";
import type { SiteData } from "@/types/SiteData";

interface HighlightsSectionProps {
  siteData: SiteData;
  showCount: number;
  memberCount: number;
  venueCount: number;
}

export default function HighlightsSection({ siteData, showCount, memberCount, venueCount }: HighlightsSectionProps) {
  const primary = siteData?.primary || "#000000";
  const surface = siteData?.surface || "#ffffff";
  const siteName = siteData?.businessInfo?.name || siteData?.name || "";
  const aboutText = siteData?.aboutSection?.description
    || `${siteName} brings together the best talent for unforgettable live experiences. Whether you're a longtime fan or discovering us for the first time, there's always something new to enjoy.`;
  const aboutHeading = siteData?.aboutSection?.heading || `About ${siteName}`;

  const stats = [
    { icon: Mic, value: `${showCount}+`, label: "Shows" },
    { icon: Users, value: `${memberCount}`, label: "Performers" },
    { icon: MapPin, value: `${venueCount}+`, label: "Venues" },
  ];

  return (
    <section className="py-20 md:py-28" style={{ background: surface }}>
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          {/* Left — About text */}
          <div>
            <h2 className="text-2xl lg:text-3xl font-display font-bold tracking-tight mb-6">
              {aboutHeading}
            </h2>
            <p className="text-gray-600 text-base md:text-lg leading-relaxed">
              {aboutText}
            </p>
          </div>

          {/* Right — Stats */}
          <div className="grid grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center text-center p-6 rounded-2xl border border-gray-200 bg-white"
              >
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${primary}15` }}
                >
                  <stat.icon size={22} style={{ color: primary }} />
                </div>
                <span className="text-2xl md:text-3xl font-bold" style={{ color: primary }}>
                  {stat.value}
                </span>
                <span className="text-sm text-gray-500 mt-1">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
