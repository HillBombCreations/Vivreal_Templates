"use client"

import { OurOfferings } from "@/types/Landing";

export default function DesktopDetailCard({
  selected,
  textPrimary,
}: {
  selected: OurOfferings;
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