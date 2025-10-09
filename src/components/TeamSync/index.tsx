"use client";

import { useState, useEffect, FC } from "react"
import {
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import clsx from "clsx"
import Image from "next/image";
import { TeamSyncDataProps } from "@/types/LandingPage/TeamSync";
import { iconMap } from '@/lib/utils';

const RolesSection: FC<TeamSyncDataProps> = (props) => {
  const { teamSyncData, siteData } = props;
  const [activeRole, setActiveRole] = useState(teamSyncData?.roles[0].id);
  const [isMobile, setIsMobile] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  
  const togglePoint = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setOpenIndex(0);
  }, [activeRole]);

  const currentRole = teamSyncData?.roles.find((role) => role.id === activeRole);
  const resolvedRoles = teamSyncData?.roles?.length
    ? teamSyncData.roles.map((role) => ({
        ...role,
        icon: iconMap[role.iconString] || (() => null),
      })) : [];

  return (
    <section style={{ background: siteData?.["surface-alt"] }} className="py-20 md:py-28">
      <div className="content-grid max-w-7xl mx-auto">
        <div className="text-center mb-5 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            {teamSyncData?.title}
          </h2>
          <p className="text-lg mt-2 max-w-xl mx-auto text-gray-600">
            {teamSyncData?.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-5 md:mb-12">
          {resolvedRoles.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.id}
                onClick={() => {
                  setActiveRole(role.id)
                  setOpenIndex(null)
                }}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition",
                  activeRole === role.id && "shadow"

                )}
                style={
                  activeRole === role.id
                    ?
                    {
                      background: siteData?.surface,
                      border: `2px solid ${role?.color}`,
                      color: siteData?.["text-primary"],
                    }
                    :
                    {
                      background: siteData?.["surface-alt"],
                      border: `2px solid ${role.color}80`,
                      color: 'text-gray-700',
                    }
                }
              >
                <Icon
                  className="w-5 h-5"
                  style={{
                    color: activeRole === role.id ? role.color : `${role.color}80`,
                  }}
                />
                {role.title}
              </button>
            )
          })}
        </div>
        <div className="grid md:grid-cols-[2fr_1fr] gap-10 items-start">
          <div className="p-6 md:p-8 rounded-xl animate-fade-in">
            {currentRole?.points.map((point, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <button
                onClick={() => togglePoint(i)}
                style={{
                  border: `1px solid ${siteData?.["text-secondary"]}`,
                  background: siteData?.surface,
                  color: siteData?.["text-primary"]
                }}
                className="w-full flex justify-between items-center py-3 px-4 rounded-lg transition focus:outline-none"
              >
                <h3 className="text-lg font-semibold">{point.title}</h3>
                {openIndex === i ? (
                  <ChevronUp style={{ color: siteData?.["text-primary"] }} className="cursor-pointer w-5 h-5" />
                ) : (
                  <ChevronDown style={{ color: siteData?.["text-primary"] }} className="cursor-pointer w-5 h-5" />
                )}
              </button>
              <div
                className={clsx(
                  "grid transition-all duration-300 ease-in-out overflow-hidden",
                  openIndex === i ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden px-4">
                  <p style={{ color: siteData?.["text-primary"] }}>{point.description}</p>
                </div>
              </div>
            </div>
          ))}
          </div>
          {
            !isMobile && (
              <div className="w-full rounded-xl overflow-hidden shadow-lg animate-fade-in">
                <Image
                  src={currentRole?.image ?? ""}
                  alt={`${currentRole?.title ?? ""} illustration`}
                  width={600}
                  height={400}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>
            )
          }
        </div>
      </div>
    </section>
  )
};

export default RolesSection;