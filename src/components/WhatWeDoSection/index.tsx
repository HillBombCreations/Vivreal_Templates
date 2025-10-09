"use client";

import { FC } from "react";
import { WhatWeDoSectionProps } from '@/types/LandingPage/WhatWeDoSeciton';
import { iconMap } from "@/lib/utils";

const WhatWeDoSection: FC<WhatWeDoSectionProps> = (props) => {
  const { whatWeDoData, siteData } = props;
  const resolvedFeatures = whatWeDoData?.features?.length
  ? whatWeDoData.features.map((feature) => ({
      ...feature,
      icon: iconMap[feature.iconString] || (() => null),
    })) : [];
  return (
    <section style={{ background: siteData?.["surface-alt"] }} className="py-20 md:py-32 relative overflow-hidden">
      <div className="content-grid mx-auto text-center animate-fade-in">
        <h2 className="text-3xl max-w-1xl text-start md:text-5xl font-display font-bold tracking-tight mb-12">
          {whatWeDoData?.title}
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          {resolvedFeatures.map(({ iconString, title, description }, i) => {
            const Icon = iconMap[iconString] || (() => null);
            return (
              <div
                key={i}
                className="flex flex-col items-center px-4 max-w-xs mx-auto"
              >
                <Icon size={50} style={{ color: siteData?.primary }} className="mb-6" />
              <div className="w-full">
                <h3 className="text-xl font-semibold text-center">{title}</h3>
              </div>
              <p style={{ color: siteData?.["text-primary"] }} className="text-sm text-start mt-2 ml-5">{description}</p>
            </div>
          )})}
        </div>
      </div>
      <div className="absolute -z-10 top-40 -left-20 h-64 w-64 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -z-10 bottom-20 right-10 h-80 w-80 bg-primary/5 rounded-full blur-3xl"></div>
    </section>

  )
};
export default WhatWeDoSection;
