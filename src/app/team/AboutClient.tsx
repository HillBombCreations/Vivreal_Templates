"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { TeamData } from "@/types/Team";
import { useSiteData } from "@/contexts/SiteDataContext";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SkeletonCard = () => (
  <div
    className="
      animate-pulse flex flex-col items-center text-center
      p-8 bg-white dark:bg-gray-800
      rounded-2xl shadow-md
    "
  >
    <div className="w-40 h-40 mb-6 rounded-full bg-gray-200 dark:bg-gray-700" />
    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
    <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
    <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded" />
  </div>
);

const AboutClient = ({ teamMembers }: { teamMembers: TeamData[] }) => {
  const [loading, setLoading] = useState(true);
  const siteData = useSiteData();

  useEffect(() => {
    setLoading(false);
  }, [teamMembers]);

  const siteName = siteData?.businessInfo?.name || siteData?.name || 'our team';

  return (
    <main className="pt-24 md:pt-32">
      <section className="mx-auto max-w-6xl px-6 mt-14">
        <h1 className="text-4xl md:text-4xl font-bold text-center mb-8">
          Meet the Team
        </h1>
        <p
          className="text-center max-w-2xl mx-auto mb-12"
          style={{ color: siteData?.["text-primary"] }}
        >
          Behind every great experience is a passionate team. Here&apos;s a glimpse of the
          people who make it possible.
        </p>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        ) : teamMembers.length === 0 ? (
          <p className="text-center text-gray-500">No team members to display at the moment.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {teamMembers.map((member, idx) => (
              <div
                key={idx}
                className="
                  group relative flex flex-col items-center text-center
                  p-8 bg-white dark:bg-gray-800
                  rounded-2xl shadow-md hover:shadow-xl
                  transition-all duration-300
                "
              >
                <div
                  className="
                    w-40 h-40 mb-6 rounded-full overflow-hidden
                    ring-4 ring-gray-100 dark:ring-gray-700
                    group-hover:ring-primary/60 transition-all duration-300
                  "
                >
                  <Image
                    src={member.imageUrl || member.image || "/logo.png"}
                    alt={member.name}
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                  />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  {member.name}
                </h3>

                <article className="prose prose-p:min-h-[.4em]">
                  <div
                    className="text-sm text-gray-600 dark:text-gray-400 max-w-xs"
                    dangerouslySetInnerHTML={{ __html: member.description }}
                  />
                </article>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-24 mx-auto max-w-4xl text-center px-6">
        <div className="space-y-6 bg-secondary/50 px-6 py-12 rounded-xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Thanks for taking the time to learn more about {siteName}!
          </h2>
          <p
            className="text-sm max-w-xl mx-auto"
            style={{ color: siteData?.["text-secondary"] }}
          >
            We&apos;re excited about the journey ahead and would love to have you with us!
          </p>
        </div>
      </section>
    </main>
  );
};

export default AboutClient;
