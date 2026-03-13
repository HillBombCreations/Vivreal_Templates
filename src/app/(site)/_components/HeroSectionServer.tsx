import { Suspense } from "react";
import HeroSection from "@/components/HeroSection";
import { getShows } from "@/lib/api/shows";
import { getPartners } from "@/lib/api/partners";
import { getSiteData, getPageCollectionId, getPageLabel } from "@/lib/api/siteData";

async function HeroSectionContent() {
  const siteData = await getSiteData();
  const showsCollectionId = getPageCollectionId(siteData, "shows", process.env.SHOWS_ID || "");
  const partnersCollectionId = getPageCollectionId(siteData, "partners", process.env.PARTNERS_ID || "");
  const [shows, partners] = await Promise.all([
    getShows(showsCollectionId),
    getPartners(partnersCollectionId),
  ]);

  const labels = {
    upcoming: getPageLabel(siteData, "shows", "upcoming", "Upcoming"),
    past: getPageLabel(siteData, "shows", "past", "Past"),
  };

  // Find the shows page slug dynamically
  const showsPage = siteData.pageConfigs?.find((p) => p.format === "shows");
  const showsSlug = showsPage?.slug || "shows";

  return <HeroSection shows={shows} siteData={siteData} labels={labels} partners={partners} showsSlug={showsSlug} />;
}

function HeroSkeleton() {
  return (
    <section className="pt-24 md:pt-32 pb-20 md:pb-32 bg-white">
      <div className="mx-5 md:mx-20 lg:mx-40 animate-pulse">
        {/* Hero Grid */}
        <div className="grid items-center gap-12 sm:grid-cols-2">
          <div className="h-80 bg-gray-200 rounded-lg" />
          <div className="space-y-5">
            <div className="h-10 w-1/3 bg-gray-200 rounded" />
            <div className="h-8 w-2/3 bg-gray-200 rounded" />
            <div className="h-4 w-5/6 bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-4 w-2/3 bg-gray-200 rounded" />
            <div className="h-10 w-40 bg-gray-200 rounded mt-6" />
          </div>
        </div>

        {/* Upcoming */}
        <div className="mt-20">
          <div className="h-8 w-1/4 bg-gray-200 rounded mb-8" />
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row rounded-lg border border-gray-100 bg-gray-100 shadow-sm overflow-hidden"
              >
                <div className="w-full sm:w-40 h-48 bg-gray-300" />
                <div className="flex-1 p-4 space-y-3">
                  <div className="h-6 w-2/3 bg-gray-300 rounded" />
                  <div className="h-4 w-5/6 bg-gray-300 rounded" />
                  <div className="h-4 w-4/6 bg-gray-300 rounded" />
                  <div className="h-8 w-24 bg-gray-300 rounded mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Past */}
        <div className="mt-20">
          <div className="h-8 w-1/4 bg-gray-200 rounded mb-8" />
          <div className="flex gap-4 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-48 h-64 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HeroSectionServer() {
  return (
    <Suspense fallback={<HeroSkeleton />}>
      <HeroSectionContent />
    </Suspense>
  );
}
