"use client";

import React, { FC } from 'react';
import FeatureCard from '../FeatureCard';
import { FeaturesSectionProps } from '@/types/LandingPage/FeaturesSection';

const FeaturesSection: FC<FeaturesSectionProps> = (props) => {
  const { featuresSection, siteData } = props;
  return (
    <section style={{background: siteData?.surface }} className="py-20 md:py-32 relative overflow-hidden">
      <div className="content-grid">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">
            {featuresSection?.title}
          </h2>
          <p style={{ color: siteData?.["text-primary"] }} className="text-lg max-w-2xl mx-auto">
            {featuresSection?.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuresSection?.features.map((feature, index) => (
            <div key={`FeatureCard-${index}`}>
              <FeatureCard
                title={feature.title}
                iconString={feature.iconString}
                description={feature.description}
                siteData={siteData}
              />
            </div>
          ))}
        </div>
      </div>

      <div style={{background: `${siteData?.primary}/5`}} className="absolute -z-10 top-40 -left-20 h-64 w-64 rounded-full blur-3xl"></div>
      <div style={{background: `${siteData?.primary}/5`}} className="absolute -z-10 bottom-20 right-10 h-80 w-80 rounded-full blur-3xl"></div>
    </section>
  );
};

export default FeaturesSection;
