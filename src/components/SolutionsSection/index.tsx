"use client";

import { FC } from "react";
import { ArrowRight } from "lucide-react";
import { SolutionsSectionProps } from "@/types/LandingPage/SolutionsSection";
import { iconMap } from "@/lib/utils";


const SolutionsSection: FC<SolutionsSectionProps> = (props) => {
  const { solutionsSection, siteData } = props;
  const resolvedSolutions = solutionsSection?.solutions?.length
  ? solutionsSection.solutions.map((solution) => ({
      ...solution,
      icon: iconMap[solution.iconString] || (() => null),
    })) : [];
  return (
    <section style={{ background: siteData?.surface }} className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden bg-gradient-to-b from-secondary/40 to-white">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-16">
          <h2 className="text-3xl md:text-4xl font-display font-bold max-w-xl tracking-tight leading-tight">
            {solutionsSection?.title}
          </h2>
          <a
            href="/solutions"
            style={{ color: siteData?.["primary"] }}
            className="mt-6 md:mt-0 inline-flex items-center font-semibold hover:underline"
          >
            {solutionsSection?.linkText} <ArrowRight className="ml-2 w-5 h-5" />
          </a>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {resolvedSolutions.map(({ id, title, description, icon }) => {
            const Icon = icon;
            return (
              <div
                key={id}
                style={{ border: `2px solid ${siteData?.primary}`, background: siteData?.surface }}
                className="group rounded-2xl p-6 transition-all duration-300"
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