/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState, JSX } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { Lightbulb, Target, Handshake } from "lucide-react";
import { OurOfferings } from "@/types/Landing";

type FeatureIcon = "lightBulb" | "target" | "heart";

type OurOfferingsProps = {
  ourOfferings: OurOfferings[];
};

const iconMap: Record<FeatureIcon, JSX.Element> = {
  lightBulb: <Lightbulb className="h-4 w-4" />,
  target: <Target className="h-4 w-4" />,
  heart: <Handshake className="h-4 w-4" />,
};

export default function OurOfferingsComponent({ ourOfferings }: OurOfferingsProps) {
  const siteData = useSiteData();

  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";
  const surface = siteData?.siteDetails?.surface ?? "var(--surface-alt,#f7f8fb)";
  const textPrimary =
    siteData?.siteDetails?.["text-primary"] ?? "var(--text-primary,#0b1220)";
  const textInverse =
    siteData?.siteDetails?.["text-inverse"] ?? "var(--text-inverse,#ffffff)";

  const first = useMemo(() => ourOfferings?.[0], [ourOfferings]);
  const [selected, setSelected] = useState<OurOfferings>(first);

  if (!selected) return null;

  return (
    <section
      style={{ background: surface }}
      className="h-[100svh] overflow-hidden py-10 md:py-10 lg:py-16"
    >
      <div className="mx-4 md:mx-10 lg:mx-40 h-full">
        <div className="lg:hidden h-full flex flex-col min-h-0">
          <div className="shrink-0">
            <div className="flex flex-wrap gap-2">
              {ourOfferings.map((card) => {
                const isSelected = card._id === selected._id;
                const icon = (card.icon as FeatureIcon) || "lightBulb";

                return (
                  <button
                    key={card._id}
                    type="button"
                    onClick={() => setSelected(card)}
                    className={[
                      "inline-flex items-center gap-2",
                      "h-10 px-3 rounded-full border",
                      "text-[13px] font-semibold transition",
                      "active:scale-[0.98]",
                      "max-w-full",
                    ].join(" ")}
                    style={{
                      borderColor: "rgba(0,0,0,0.10)",
                      background: isSelected ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                      color: "rgba(0,0,0,0.78)",
                    }}
                  >
                    <span
                      className="grid place-items-center h-7 w-7 rounded-full shrink-0"
                      style={{
                        background: isSelected ? primary : "rgba(0,0,0,0.06)",
                        color: isSelected ? textInverse : "rgba(0,0,0,0.70)",
                      }}
                    >
                      {iconMap[icon]}
                    </span>

                    <span className="truncate max-w-[38vw]">{card.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 mt-4">
            <MobileDetailCard
              selected={selected}
              primary={primary}
              textPrimary={textPrimary}
              textInverse={textInverse}
            />
          </div>
        </div>

        <div className="hidden lg:grid h-full min-h-0 grid-cols-12 gap-10 items-center">
          <div className="col-span-5 flex flex-col justify-center gap-3 min-h-0">
            {ourOfferings.map((card) => {
              const isSelected = card._id === selected._id;
              const icon = (card.icon as FeatureIcon) || "lightBulb";

              return (
                <button
                  key={card._id}
                  type="button"
                  onClick={() => setSelected(card)}
                  className={[
                    "w-full cursor-pointer rounded-2xl border text-left transition",
                    "flex items-center gap-4",
                    "h-[92px] xl:h-[104px]",
                    "px-5 py-4",
                    isSelected ? "bg-white shadow-md" : "bg-white/70 hover:bg-white",
                  ].join(" ")}
                  style={{ borderColor: "rgba(0,0,0,0.08)" }}
                >
                  <div
                    className="shrink-0 grid place-items-center rounded-full h-11 w-11"
                    style={{
                      background: isSelected ? primary : "rgba(0,0,0,0.06)",
                      color: isSelected ? textInverse : "rgba(0,0,0,0.70)",
                    }}
                  >
                    <span className="[&>svg]:h-5 [&>svg]:w-5">{iconMap[icon]}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight" style={{ color: textPrimary }}>
                      {card.title}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-black/60 line-clamp-2">
                      {card.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="col-span-7 h-full min-h-0">
            <DesktopDetailCard selected={selected} primary={primary} textPrimary={textPrimary} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileDetailCard({
  selected,
  primary,
  textPrimary,
  textInverse,
}: {
  selected: any;
  primary: string;
  textPrimary: string;
  textInverse: string;
}) {
  return (
    <div
      className="h-full min-h-0 rounded-3xl border bg-white shadow-sm overflow-hidden flex flex-col"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="shrink-0 px-5 py-4" style={{ background: primary, color: textInverse }}>
        <div className="text-sm font-semibold truncate">{selected.title}</div>
        <div className="mt-1 text-xs opacity-90 line-clamp-2">{selected.description}</div>
      </div>

      <div className="flex-1 min-h-0 p-4">
        <div
          className="h-full w-full rounded-2xl border bg-black/5 overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >

          <div className="h-full w-full flex items-center justify-center p-3">
            <img
              src={selected.imageUrl || "/heroImage.png"}
              alt={selected.title}
              draggable={false}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopDetailCard({
  selected,
  primary,
  textPrimary,
}: {
  selected: any;
  primary: string;
  textPrimary: string;
}) {
  return (
    <div
      className="h-full min-h-0 rounded-3xl border bg-white shadow-sm overflow-hidden flex flex-col"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="p-6">
        <div className="text-xl font-semibold tracking-tight" style={{ color: textPrimary }}>
          {selected.title}
        </div>
        <div className="mt-2 text-sm leading-relaxed text-black/60 max-w-2xl">
          {selected.description}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-6">
        <div
          className="h-full w-full rounded-2xl border bg-black/5 overflow-hidden"
          style={{ borderColor: "rgba(0,0,0,0.08)" }}
        >
          <div className="h-full w-full flex items-center justify-center p-6">
            <img
              src={selected.imageUrl || "/heroImage.png"}
              alt={selected.title}
              draggable={false}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}