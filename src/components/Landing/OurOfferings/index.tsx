"use client";

import Image from "next/image";
import { useState, JSX } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { Lightbulb, Target, Handshake } from "lucide-react";
import { OurOfferings } from "@/types/Landing";
type FeatureIcon = "lightBulb" | "target" | "heart";

type OurOfferingsProps = {
  ourOfferings: OurOfferings[];
};

const iconMap: Record<FeatureIcon, JSX.Element> = {
  lightBulb: <Lightbulb className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  heart: <Handshake className="h-5 w-5" />,
};

export default function OurOfferingsComponent({
  ourOfferings,
}: OurOfferingsProps) {
  const siteData = useSiteData();
  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surfaceAlt = siteData?.siteDetails?.["surface-alt"] ?? "var(--surface-alt,#f7f8fb)";

  const [selected, setSelected] = useState<OurOfferings>(ourOfferings[0]);

  return (
    <section
      style={{ background: surfaceAlt }}
      className="relative overflow-hidden py-14 md:py-20"
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl opacity-15"
        style={{
          background: `radial-gradient(circle at center, ${primary} 0%, transparent 70%)`,
        }}
      />

      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid gap-10 lg:grid-cols-12 items-center">
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-3">
              {ourOfferings.map((card) => {
                const isSelected = card._id === selected._id;
                const icon = card.icon as FeatureIcon;
                return (
                  <button
                    key={card._id}
                    onClick={() => setSelected(card)}
                    className={[
                      "group w-full rounded-2xl border p-4 text-left transition",
                      "flex items-start gap-4",
                      isSelected
                        ? "bg-white shadow-md"
                        : "bg-white/60 hover:bg-white",
                    ].join(" ")}
                    style={{
                      borderColor: "rgba(0,0,0,0.08)",
                    }}
                  >
                    <div
                      className={[
                        "flex h-10 w-10 items-center justify-center rounded-full transition",
                        isSelected ? "text-white" : "text-black/70",
                      ].join(" ")}
                      style={{
                        background: isSelected ? primary : "rgba(0,0,0,0.05)",
                      }}
                    >
                      { iconMap[icon] }
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold tracking-tight">
                        {card.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-black/60">
                        {card.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7">
            <div
              key={selected._id}
              className="relative rounded-3xl border bg-white/70 p-6 shadow-sm backdrop-blur animate-fadeSlideIn"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div
                className="pointer-events-none absolute inset-0 rounded-3xl opacity-30"
                style={{
                  background: `linear-gradient(135deg, ${primary}22 0%, transparent 55%)`,
                }}
              />

              <div className="relative flex items-center justify-center min-h-[260px] md:min-h-[360px]">
                <img
                  src={selected.imageUrl || "heroImage.png"}
                  alt={selected.title}
                  width={800}
                  height={600}
                  className="h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 300ms ease-out;
        }
      `}</style>
    </section>
  );
}
