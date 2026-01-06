"use client";

import { useEffect, useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { ProductSearchProps } from "@/types/Products";

const DEBOUNCE_MS = 350;

export default function ProductSearch({
  initialValue = "",
  loading = false,
  onSearch,
}: ProductSearchProps) {
    const [value, setValue] = useState(initialValue);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setValue(initialValue);
    }, [initialValue]);

    useEffect(() => {
        return () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const triggerSearch = (val: string) => {
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
        onSearch(val);
        }, DEBOUNCE_MS);
    };
  return (
    <div
      className="mt-4 rounded-2xl border bg-white/70 backdrop-blur px-3 py-2"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-black/50" />

        <input
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            setValue(next);
            triggerSearch(next);
          }}
          disabled={loading}
          placeholder="Search products…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-black/40 disabled:opacity-60"
        />

        {value?.length ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setValue("");
              onSearch("");
            }}
            className="h-8 w-8 inline-flex cursor-pointer items-center justify-center rounded-xl transition hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Clear search"
            title="Clear"
          >
            <X className="h-4 w-4 text-black/60" />
          </button>
        ) : null}
      </div>
    </div>
  );
}