"use client";

import { useEffect, useState } from "react";
import { X, SlidersHorizontal, Check, ChevronDown } from "lucide-react";
import type { Filter, SortOption } from "@/types/Products";

interface MobileFilterSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sortKey: string;
  filterType: string;
  filterGroupType: string;
  groups: Filter[];
  sortOptions: SortOption[];
  loading?: boolean;
  onApply: (next: {
    filterValue: string;
    filterGroupType: string;
    sortKey: string;
  }) => void;
  onClear: () => void;
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function MobileFilterSheet({
  open,
  onOpenChange,
  sortKey,
  filterType,
  filterGroupType,
  groups,
  sortOptions,
  loading,
  onApply,
  onClear,
}: MobileFilterSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [draftSort, setDraftSort] = useState(sortKey);
  const [draftFilterValue, setDraftFilterValue] = useState(filterType);
  const [draftFilterGroupType, setDraftFilterGroupType] =
    useState(filterGroupType);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [sortOpen, setSortOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMounted(true);
    setDraftSort(sortKey);
    setDraftFilterValue(filterType);
    setSortOpen(false);
    setDraftFilterGroupType(filterGroupType || groups?.[0]?.key || "");

    setOpenGroups(() =>
      (groups || []).reduce(
        (acc, g, idx) => {
          acc[g.key] = idx === 0;
          return acc;
        },
        {} as Record<string, boolean>
      )
    );
  }, [open, sortKey, filterType, filterGroupType, groups]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const apply = () => {
    onApply({
      filterValue: draftFilterValue,
      filterGroupType: draftFilterGroupType,
      sortKey: draftSort,
    });
    onOpenChange(false);
  };

  const clear = () => {
    setDraftSort("featured");
    setDraftFilterValue("");
    setSortOpen(false);
    setDraftFilterGroupType(groups?.[0]?.key || "");
    onClear();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        onClick={() => onOpenChange(false)}
        aria-label="Close filters"
      />

      <div className="absolute inset-x-0 bottom-0">
        <div
          role="dialog"
          aria-modal="true"
          className={`
            w-full h-[70svh]
            bg-white/90 backdrop-blur
            border-t border-black/10
            rounded-t-3xl
            shadow-[0_-12px_40px_rgba(0,0,0,0.18)]
            flex flex-col
            transform transition-transform duration-200 ease-out
            ${mounted ? "translate-y-0" : "translate-y-full"}
          `}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-black/10 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-black/60" />
                <h3 className="text-sm font-semibold tracking-tight">
                  Filters & Sort
                </h3>
              </div>
              <button
                type="button"
                className="rounded-xl p-2 text-black/60 hover:text-black"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {/* Filter groups */}
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
              <p className="text-[12px] font-semibold text-black/70">Filter</p>
              <div className="mt-3 flex flex-col gap-3">
                {groups.map((g) => {
                  const isOpen = !!openGroups[g.key];
                  const hasOptions = !!g.filters?.length;

                  return (
                    <div
                      key={g.key}
                      className="rounded-2xl border bg-white/70 backdrop-blur"
                      style={{ borderColor: "rgba(0,0,0,0.08)" }}
                    >
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          setOpenGroups((prev) => ({
                            ...prev,
                            [g.key]: !prev[g.key],
                          }))
                        }
                        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <span>{g.title}</span>
                        <ChevronDown
                          className={`h-4 w-4 text-black/50 transition-transform ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4">
                          {hasOptions ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                  setDraftFilterGroupType(g.key);
                                  setDraftFilterValue("");
                                }}
                                className="rounded-full border px-3 py-1.5 text-[12px] font-semibold"
                                style={{
                                  borderColor:
                                    draftFilterGroupType === g.key &&
                                    draftFilterValue === ""
                                      ? "var(--primary)"
                                      : "rgba(0,0,0,0.10)",
                                  color: "rgba(0,0,0,0.75)",
                                  background:
                                    draftFilterGroupType === g.key &&
                                    draftFilterValue === ""
                                      ? "rgba(0,0,0,0.03)"
                                      : "transparent",
                                }}
                              >
                                All
                              </button>

                              {g.filters!.map((filter) => {
                                const active =
                                  draftFilterGroupType === g.key &&
                                  draftFilterValue === filter;
                                return (
                                  <button
                                    key={`${g.key}-${filter}`}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => {
                                      setDraftFilterGroupType(g.key);
                                      setDraftFilterValue(filter);
                                    }}
                                    className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
                                    style={{
                                      borderColor: active
                                        ? "var(--primary)"
                                        : "rgba(0,0,0,0.10)",
                                      background: active
                                        ? "rgba(0,0,0,0.03)"
                                        : "transparent",
                                      color: "rgba(0,0,0,0.75)",
                                    }}
                                  >
                                    {capitalize(filter)}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[13px] text-black/50">
                              No filters
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sort section */}
            <div className="mt-4 rounded-2xl border border-black/10 bg-white/70">
              <button
                type="button"
                disabled={loading}
                onClick={() => setSortOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-4 text-left disabled:opacity-60 disabled:pointer-events-none"
                aria-expanded={sortOpen}
              >
                <span className="text-[12px] font-semibold text-black/70">
                  Sort
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-black/60">
                    {sortOptions.find((o) => o.key === draftSort)?.label ??
                      "Featured"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-black/50 transition-transform ${
                      sortOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </span>
              </button>

              {sortOpen && (
                <div className="px-4 pb-4">
                  <div className="mt-1 grid gap-2">
                    {sortOptions.map((opt) => {
                      const active = draftSort === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setDraftSort(opt.key)}
                          disabled={loading}
                          className="flex w-full items-center justify-between rounded-xl border px-3 py-4 text-left text-[13px] font-semibold transition active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
                          style={{
                            borderColor: active
                              ? "var(--primary)"
                              : "rgba(0,0,0,0.10)",
                            background: active
                              ? "rgba(0,0,0,0.02)"
                              : "transparent",
                          }}
                        >
                          <span className="text-black/80">{opt.label}</span>
                          {active && (
                            <Check
                              className="h-4 w-4"
                              style={{ color: "var(--primary)" }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-black/10 px-5 py-4 bg-white/80 backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={clear}
                disabled={loading}
                className="h-11 rounded-2xl border border-black/10 bg-white/70 text-sm font-semibold disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={loading}
                className="h-11 rounded-2xl text-sm font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-50"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {loading ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
