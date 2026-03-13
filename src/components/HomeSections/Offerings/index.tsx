"use client";

import { useMemo, useState } from "react";
import type { HomeSectionProps } from "../index";
import type { OfferingItem, FeatureIcon } from "@/types/Landing";
import { IconMap } from "@/types/Landing";

/* ---------- Sub-components (inlined to keep single-file) ---------- */

function DesktopDetailCard({
  selected,
  textPrimary,
}: {
  selected: OfferingItem;
  textPrimary: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
      <div className="p-6 pb-4">
        <h3
          className="text-xl font-bold tracking-tight"
          style={{ color: textPrimary }}
        >
          {selected.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-black/50 max-w-2xl">
          {selected.description}
        </p>
      </div>

      <div className="px-6 pb-6">
        <div className="rounded-xl overflow-hidden bg-black/[0.02] border border-black/[0.04]">
          <div className="flex items-center justify-center p-8 min-h-[360px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.imageUrl || "/vrlogo.png"}
              alt={selected.title}
              draggable={false}
              className="max-h-[320px] w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileDetailCard({
  selected,
  primary,
  textInverse,
}: {
  selected: OfferingItem;
  primary: string;
  textInverse: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
      <div
        className="px-5 py-4"
        style={{ background: primary, color: textInverse }}
      >
        <div className="text-sm font-semibold truncate">{selected.title}</div>
        <div className="mt-1 text-xs opacity-80 line-clamp-2">
          {selected.description}
        </div>
      </div>

      <div className="p-4">
        <div className="rounded-xl overflow-hidden bg-black/[0.02] border border-black/[0.04]">
          <div className="flex items-center justify-center p-4 min-h-[220px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.imageUrl || "/vrlogo.png"}
              alt={selected.title}
              draggable={false}
              className="max-h-[200px] w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main component ---------- */

const Offerings = ({ siteData, prefetchedData }: HomeSectionProps) => {
  const items = (prefetchedData?.items as OfferingItem[]) || [];

  const primary = siteData?.primary ?? "#1a1a2e";
  const surfaceAlt = siteData?.["surface-alt"] ?? "#f8f9fb";
  const textPrimary = siteData?.["text-primary"] ?? "#0b1220";
  const textInverse = siteData?.["text-inverse"] ?? "#ffffff";

  const first = useMemo(() => items[0], [items]);
  const [selected, setSelected] = useState<OfferingItem | undefined>(first);

  if (!selected || items.length === 0) return null;

  return (
    <section
      style={{ background: surfaceAlt }}
      className="relative overflow-hidden py-20 md:py-28"
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-12">
        {/* Section heading */}
        <div className="max-w-2xl mb-12 lg:mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            What we offer
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-black/55">
            Everything you need, all in one place.
          </p>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden">
          <div className="flex flex-wrap gap-2 mb-6">
            {items.map((card, idx) => {
              const isSelected = card._id ? card._id === selected._id : idx === items.indexOf(selected);
              const icon = (card.icon as FeatureIcon) || "lightBulb";

              return (
                <button
                  key={card._id || idx}
                  type="button"
                  onClick={() => setSelected(card)}
                  className="inline-flex items-center gap-2 h-10 px-3.5 rounded-full border text-[13px] font-medium transition active:scale-[0.98]"
                  style={{
                    borderColor: isSelected ? `${primary}30` : "rgba(0,0,0,0.06)",
                    background: isSelected ? "white" : "rgba(255,255,255,0.6)",
                    color: isSelected ? primary : "rgba(0,0,0,0.65)",
                    boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  <span
                    className="grid place-items-center h-6 w-6 rounded-full shrink-0"
                    style={{
                      background: isSelected ? primary : "rgba(0,0,0,0.05)",
                      color: isSelected ? textInverse : "rgba(0,0,0,0.55)",
                    }}
                  >
                    <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
                      {IconMap[icon] || IconMap.lightBulb}
                    </span>
                  </span>
                  <span className="truncate">{card.title}</span>
                </button>
              );
            })}
          </div>

          <MobileDetailCard
            selected={selected}
            primary={primary}
            textInverse={textInverse}
          />
        </div>

        {/* Desktop layout */}
        <div className="hidden lg:grid grid-cols-12 gap-8 items-start">
          <div className="col-span-5 flex flex-col gap-3">
            {items.map((card, idx) => {
              const isSelected = card._id ? card._id === selected._id : idx === items.indexOf(selected);
              const icon = (card.icon as FeatureIcon) || "lightBulb";

              return (
                <button
                  key={card._id || idx}
                  type="button"
                  onClick={() => setSelected(card)}
                  className="w-full cursor-pointer rounded-2xl border text-left transition-all flex items-center gap-4 px-5 py-5"
                  style={{
                    borderColor: isSelected ? `${primary}20` : "rgba(0,0,0,0.04)",
                    background: isSelected ? "white" : "rgba(255,255,255,0.5)",
                    boxShadow: isSelected
                      ? "0 4px 16px rgba(0,0,0,0.06)"
                      : "none",
                  }}
                >
                  <div
                    className="shrink-0 grid place-items-center rounded-xl h-11 w-11"
                    style={{
                      background: isSelected ? primary : "rgba(0,0,0,0.04)",
                      color: isSelected ? textInverse : "rgba(0,0,0,0.55)",
                    }}
                  >
                    <span className="[&>svg]:h-5 [&>svg]:w-5">
                      {IconMap[icon] || IconMap.lightBulb}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div
                      className="text-sm font-semibold tracking-tight"
                      style={{ color: textPrimary }}
                    >
                      {card.title}
                    </div>
                    <div className="mt-1 text-sm leading-relaxed text-black/50 line-clamp-2">
                      {card.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="col-span-7">
            <DesktopDetailCard selected={selected} textPrimary={textPrimary} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Offerings;
