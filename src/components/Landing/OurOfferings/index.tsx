"use client";

import { useState, JSX, useMemo } from "react";
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

export default function OurOfferingsComponent({ ourOfferings }: OurOfferingsProps) {
  const siteData = useSiteData();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surfaceAlt =
    siteData?.siteDetails?.["surface-alt"] ?? "var(--surface-alt,#f7f8fb)";
  const textPrimary = siteData?.siteDetails?.["text-primary"] ?? "var(--text-primary,#0b1220)";
  const textInverse = siteData?.siteDetails?.["text-inverse"] ?? "var(--text-inverse,#ffffff)";

  const safeFirst = useMemo(() => ourOfferings?.[0], [ourOfferings]);
  const [selected, setSelected] = useState<OurOfferings>(safeFirst);

  if (!selected) return null;

  return (
    <section style={{ background: surfaceAlt }} className="py-12 md:py-20">
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <div className="flex flex-col gap-3">
              {ourOfferings.map((card) => {
                const isSelected = card._id === selected._id;
                const icon = (card.icon as FeatureIcon) || "lightBulb";

                return (
                  <button
                    key={card._id}
                    type="button"
                    onClick={() => setSelected(card)}
                    className={[
                      "w-full cursor-pointer rounded-2xl border p-4 text-left transition",
                      "flex items-start gap-4",
                      isSelected ? "bg-white shadow-md" : "bg-white/70 hover:bg-white",
                    ].join(" ")}
                    style={{ borderColor: "rgba(0,0,0,0.08)" }}
                  >
                    <div
                      className={[
                        "shrink-0 grid place-items-center rounded-full",
                        "h-11 w-11",
                      ].join(" ")}
                      style={{
                        background: isSelected ? primary : "rgba(0,0,0,0.06)",
                        color: isSelected ? textInverse : "rgba(0,0,0,0.70)",
                      }}
                    >
                      {iconMap[icon]}
                    </div>

                    <div className="min-w-0">
                      <h3
                        className="text-sm font-semibold tracking-tight"
                        style={{ color: textPrimary }}
                      >
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
              className="rounded-3xl border bg-white shadow-sm overflow-hidden animate-fadeSlideIn"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <div
                className="px-5 py-4"
                style={{ background: primary, color: textInverse }}
              >
                <div className="text-sm font-semibold">{selected.title}</div>
                <div className="text-xs opacity-90 mt-0.5">
                  {selected.description}
                </div>
              </div>

              <div className="p-5 md:p-6">
                <div className="w-full aspect-[16/9] rounded-2xl bg-black/5 grid place-items-center overflow-hidden">
                  <img
                    src={selected.imageUrl || "/heroImage.png"}
                    alt={selected.title}
                    width={1200}
                    height={800}
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeSlideIn {
          animation: fadeSlideIn 260ms ease-out;
        }
      `}</style>
    </section>
  );
}