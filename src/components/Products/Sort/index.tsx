// components/ProductSort.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import { ProductSortProps } from "@/types/Products";

export default function ProductSort({
  value,
  options,
  loading = false,
  onChange,
}: ProductSortProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-2 cursor-pointer rounded-2xl border bg-white/70 backdrop-blur px-3 py-2",
          "text-sm font-semibold shadow-sm transition hover:bg-white",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
        ].join(" ")}
        style={{ borderColor: "rgba(0,0,0,0.08)" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ArrowUpDown className="h-4 w-4 text-black/60" />
        <span className="text-black/70">Sort:</span>
        <span className="text-black">{selected?.label ?? "Select"}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-2xl border bg-white/90 backdrop-blur shadow-lg p-2"
          style={{ borderColor: "rgba(0,0,0,0.10)" }}
        >
          {options.map((opt) => {
            const active = opt.key === selected?.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={[
                  "w-full rounded-xl cursor-pointer px-3 py-2 text-left text-sm font-semibold transition",
                  "hover:bg-black/5",
                ].join(" ")}
                style={{
                  background: active ? "rgba(0,0,0,0.06)" : "transparent",
                  color: "rgba(0,0,0,0.78)",
                }}
              >
                <span className="inline-flex w-full items-center justify-between gap-3">
                  <span>{opt.label}</span>
                  {active ? <Check className="h-4 w-4 text-black/60" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
