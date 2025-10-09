"use client";

import { FC, useEffect, useState } from 'react';
import { hexToRgba, iconMap } from "@/lib/utils";
import { HeroSectionProps, PointCardProps } from '@/types//LandingPage/HeroSection';
import GetStartedButton from '../GetStartedButton';

const HeroSection: FC<HeroSectionProps> = (props) => {
  const {
    page,
    heroSectionData,
    titleLine1,
    titleLine2,
    subtitle,
    button,
    sectionMargin,
    titleSize,
    subtitleSize,
    pointColumns,
    pointIconSize,
    pointTitleSize,
    pointDescSize,
    pointsMarginTop,
    dataPoints,
    siteData
  } = props;

  const [isMobile, setIsMobile] = useState(false);
  // Fallback styles
  const defaultStyles = {
    sectionMargin: "mx-5 md:mx-40 lg:mx-50",
    titleSize: "text-4xl lg:text-4xl 2xl:text-5xl",
    subtitleSize: "text-md 2xl:text-lg",
    pointColumns: "md:grid-cols-2 lg:grid-cols-4",
    pointIconSize: "w-8 h-8",
    pointTitleSize: "text-lg sm:text-md md:text-lg",
    pointDescSize: "text-sm",
    pointsMarginTop: "mt-14",
    buttonSubText: "text-sm",
  };

  const resolvedTitle = titleLine1 ?? heroSectionData?.title?.split('/')?.[0] ?? '';
  const resolvedTitle2 = titleLine2 ?? heroSectionData?.title?.split('/')?.[1] ?? '';
  const resolvedSubtitle = subtitle ?? heroSectionData?.subtitle ?? '';
  const resolvedButton = button ?? heroSectionData?.button;
  const resolvedDataPoints = dataPoints?.length
  ? dataPoints.map((point: PointCardProps) => ({
      ...point,
      icon: iconMap[point.iconString] || (() => null),
    }))
  : heroSectionData?.dataPoints?.length ? heroSectionData.dataPoints.map((point: PointCardProps) => ({
      ...point,
      icon: iconMap[point.iconString] || (() => null),
    })) : [];

  const pageLayout = siteData?.pages?.[`${page}-hero`];

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
    <section
      style={{ background: siteData?.surface }}
      className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <div className={sectionMargin ?? defaultStyles.sectionMargin}>
        <div className="rounded-xl px-5 py-20 md:p-12" style={{ background: isMobile ? hexToRgba("#1D4ED8", 0.2) : siteData?.['text-inverse'] }}>
          <div
            className={`
              grid items-center gap-12 
              ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "grid-cols-1" : "sm:grid-cols-2 md:grid-cols-2"}
            `}
          >
            <div
              className={`
                ${pageLayout === "horizontal-reverse" || pageLayout === "vertical-reverse" ? "order-2" : "order-1"}
                ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "mx-auto max-w-xl" : ""}
              `}
            >
              <div className={`space-y-6 ${pageLayout?.includes("vertical") ? "text-center" : ""}`}>
                <h1
                  id="hero-heading"
                  className={`${titleSize ?? defaultStyles.titleSize} font-display font-bold tracking-tight animate-fade-in`}
                  style={{ animationDelay: '200ms' }}
                >
                  <span>{resolvedTitle}</span>
                  <span className="block" style={{ color: siteData?.primary }}>{resolvedTitle2}</span>
                </h1>
                <p
                  className={`${subtitleSize ?? defaultStyles.subtitleSize} animate-fade-in`}
                  style={{ animationDelay: '300ms', color: siteData?.['text-secondary'] }}
                >
                  {resolvedSubtitle}
                </p>
                {resolvedButton && (
                  <>
                    <div className="animate-fade-in" style={{ animationDelay: '400ms' }}>
                      <GetStartedButton
                        page="Landing"
                        color={resolvedButton?.color ?? ""}
                      />
                    </div>
                    <p
                      className={`${defaultStyles.buttonSubText} animate-fade-in`}
                      style={{ animationDelay: '500ms', color: siteData?.['text-secondary'] }}
                    >
                      {resolvedButton.subtext}
                    </p>
                  </>
                )}
              </div>
            </div>

            <div
              className={`
                relative
                ${pageLayout === "horizontal-reverse" || pageLayout === "vertical-reverse" ? "order-1" : "order-2"}
              `}
            >
              <div
                className={`
                  relative rounded-xl overflow-visible animate-fade-in
                  ${pageLayout?.includes("vertical") ? "flex items-center justify-center" : ""}
                `}
                style={{ animationDelay: '600ms' }}
              >
                <div className="w-fulltransition-opacity duration-300">
                    <video
                      src="/movingHero.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-auto rounded-md"
                    />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`${pointColumns ?? defaultStyles.pointColumns} ${pointsMarginTop ?? defaultStyles.pointsMarginTop} gap-8 grid`}>
          {resolvedDataPoints.map((point, index) => (
            <div key={index} className="rounded-xl transition-all text-center">
              {point.icon && (
                <point.icon
                  size={28}
                  style={{ color: point.color }}
                  className={`${pointIconSize ?? defaultStyles.pointIconSize} mx-auto mb-4`}
                />
              )}
              <h2 className={`${pointTitleSize ?? defaultStyles.pointTitleSize} font-semibold mb-2`}>
                {point.title}
              </h2>
              <p className={`${pointDescSize ?? defaultStyles.pointDescSize} text-gray-800`}>
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;