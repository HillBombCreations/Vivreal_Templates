"use client";

import { OurOfferings } from "@/types/Landing";

export default function MobileDetailCard({
  selected,
  primary,
  textInverse,
}: {
  selected: OurOfferings;
  primary: string;
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