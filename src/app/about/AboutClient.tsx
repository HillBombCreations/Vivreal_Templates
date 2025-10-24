"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getTeamMembers } from "@/lib/api/team";
import { TeamData } from "@/types/Team"
import { useSiteData } from "@/contexts/SiteDataContext";

// Force runtime fetching instead of static build
export const dynamic = "force-dynamic";
export const revalidate = 0;

const AboutClient = () => {
  const siteData = useSiteData();
  const [teammates, setTeammates] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const data = await getTeamMembers();
        setTeammates(data);
      } catch (err) {
        console.error("Failed to fetch team members:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, []);

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
          Behind every product is a passionate team. Here&apos;s a glimpse of the
          people who make it possible.
        </p>
        {loading ? (
          <p className="mt-6 text-gray-500 text-center">Loading team members...</p>
        ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {teammates.map((member, idx) => (
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
                  src={member.image || '/comedycollectiveLogo.png'}
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
                <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xs" dangerouslySetInnerHTML={{ __html: member.description }} />
              </article>
            </div>
          ))}
        </div>
        )}
      </section>
      <section className="mt-24 mx-auto max-w-4xl text-center px-6">
        <div className="space-y-6 bg-secondary/50 px-6 py-12 rounded-xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Thanks for taking the time to learn more about our team!
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
