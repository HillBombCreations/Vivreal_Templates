"use client";

import { Search, X } from "lucide-react";
import { ProductSearchProps } from "@/types/Products";

export default function ProductSearch({
  search = "",
  loading = false,
  onSearch,
  setSearch
}: ProductSearchProps) {
  return (
    <div
      className="mt-4 rounded-2xl border bg-white/70 backdrop-blur px-3 py-2"
      style={{ borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-black/50" />

        <input
          value={search}
          onChange={(e) => {
            const next = e.target.value;
            setSearch(next);
          }}
          disabled={loading}
          placeholder="Search products…"
          className="w-full bg-transparent text-base md:text-sm outline-none placeholder:text-black/40 disabled:opacity-60"
        />

        {search?.length ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
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