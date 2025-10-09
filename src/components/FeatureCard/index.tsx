"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { FeatureCardProps } from '@/types/LandingPage/FeaturesSection';
import { iconMap } from '@/lib/utils';
import { hexToRgba } from '@/lib/utils';

const FeatureCard = ({ 
  iconString, 
  title, 
  description,
  siteData
}: FeatureCardProps) => {
  const Icon = iconMap[iconString] || (() => null);
  return (
    <div
      className={cn(
        "flex flex-col items-center md:items-start mb-2 md:mb-0 lg:mb-0 space-y-3"
      )}
    >
      <div style={{ background: hexToRgba(siteData?.["text-secondary"] ?? "", .2) }} className="h-12 w-12 rounded-lg flex items-center justify-center mb-2">
        <Icon size={28} style={{ color: siteData?.primary }} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-gray-800 text-center md:text-start text-sm max-w-xs">{description}</p>
    </div>
  );
};

export default FeatureCard;